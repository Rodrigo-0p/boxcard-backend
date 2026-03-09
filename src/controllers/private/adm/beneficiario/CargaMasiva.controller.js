const { executeQueryWithSession } = require('../../../../config/database');
const { log_error, log_info } = require('../../../../log/logger');
const moment = require('moment');

/**
 * Carga masiva con lógica UPSERT:
 *  - No existe en esta empresa  → INSERT como Activo
 *  - Existe Inactivo             → UPDATE datos + reactivar como Activo
 *  - Existe Activo               → Rechazar (ya activo)
 *  - Activo en otra empresa      → INSERT/UPDATE como Inactivo (no puede estar activo en 2 empresas)
 */
exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { beneficiarios } = req.body;

        if (!beneficiarios || !Array.isArray(beneficiarios) || beneficiarios.length === 0) {
            return res.status(400).json({ success: false, mensaje: 'Se requiere un array de beneficiarios' });
        }

        const results = {
            insertados: 0,   // Nuevos registros activos
            reactivados: 0,   // Existían inactivos y se reactivaron
            inactivos: 0,   // Insertados/actualizados como Inactivo (activo en otra empresa)
            rechazados: 0,
            errores: []
        };

        for (let i = 0; i < beneficiarios.length; i++) {
            const b = beneficiarios[i];

            try {
                if (!b.nro_documento || !b.nombre_completo) {
                    results.rechazados++;
                    results.errores.push({ fila: i + 1, documento: b.nro_documento || 'N/A', error: 'Documento y Nombre son obligatorios' });
                    continue;
                }

                // ── ¿Activo en OTRA empresa? ─────────────────────────────
                const otraEmpresaQuery = `
                    SELECT e.nombre AS empresa_nombre
                      FROM nominas_benef nb
                      JOIN empresas e ON nb.cod_empresa = e.cod_empresa
                     WHERE nb.nro_documento = $1
                       AND nb.estado = 'A'
                       AND nb.cod_empresa != $2
                     LIMIT 1
                `;
                const otraResult = await executeQueryWithSession(user, otraEmpresaQuery, [b.nro_documento, user.cod_empresa]);
                const yaActivoOtra = otraResult.success && otraResult.data.length > 0;
                const estadoFinal = yaActivoOtra ? 'I' : 'A';

                // ── ¿Existe en ESTA empresa? ─────────────────────────────
                const existeQuery = `
                    SELECT cod_beneficiario, estado
                      FROM nominas_benef
                     WHERE nro_documento = $1 AND cod_empresa = $2
                     LIMIT 1
                `;
                const existeResult = await executeQueryWithSession(user, existeQuery, [b.nro_documento, user.cod_empresa]);

                if (existeResult.success && existeResult.data.length > 0) {
                    const reg = existeResult.data[0];

                    if (reg.estado === 'A') {
                        // Ya activo en esta empresa → rechazar
                        results.rechazados++;
                        results.errores.push({ fila: i + 1, documento: b.nro_documento, error: 'Ya existe y está activo en esta empresa' });
                        continue;
                    }

                    // Existe Inactivo → UPDATE + reactivar (o mantener Inactivo si activo en otra)
                    const updateQuery = `
                        UPDATE nominas_benef
                           SET nombre_completo = $1
                             , ruc             = $2
                             , correo          = $3
                             , nro_telef       = $4
                             , monto_limite    = $5
                             , estado          = $6
                             , fecha_mod       = NOW()
                             , usuario_mod     = $7
                         WHERE cod_beneficiario = $8
                           AND cod_empresa      = $9
                    `;
                    const upParams = [
                        b.nombre_completo,
                        b.ruc || null,
                        b.correo || null,
                        b.nro_telef || null,
                        b.monto_limite ?? 0,
                        estadoFinal,
                        user.username || 'CARGA_MASIVA',
                        reg.cod_beneficiario,
                        user.cod_empresa
                    ];
                    const upResult = await executeQueryWithSession(user, updateQuery, upParams);
                    if (upResult.success) {
                        yaActivoOtra ? results.inactivos++ : results.reactivados++;
                    } else {
                        results.rechazados++;
                        results.errores.push({ fila: i + 1, documento: b.nro_documento, error: upResult.message || 'Error al reactivar' });
                    }
                    continue;
                }

                // ── No existe → INSERT ───────────────────────────────────
                const insertQuery = `
                    INSERT INTO nominas_benef (
                        cod_empresa, nro_documento, ruc, nombre_completo,
                        correo, nro_telef, monto_limite, estado, fecha_alta, usuario_alta
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
                `;
                const insParams = [
                    user.cod_empresa,
                    b.nro_documento,
                    b.ruc || null,
                    b.nombre_completo,
                    b.correo || null,
                    b.nro_telef || null,
                    b.monto_limite ?? 0,
                    estadoFinal,
                    user.username || 'CARGA_MASIVA'
                ];
                const insResult = await executeQueryWithSession(user, insertQuery, insParams);
                if (insResult.success) {
                    yaActivoOtra ? results.inactivos++ : results.insertados++;
                } else {
                    results.rechazados++;
                    results.errores.push({ fila: i + 1, documento: b.nro_documento, error: insResult.message || 'Error al insertar' });
                }

            } catch (rowError) {
                log_error.error(`Error fila ${i + 1}:`, rowError.message);
                results.rechazados++;
                results.errores.push({ fila: i + 1, documento: b.nro_documento || 'N/A', error: rowError.message });
            }
        }

        log_info.info(
            `Carga masiva: ${results.insertados} nuevos, ${results.reactivados} reactivados, ` +
            `${results.inactivos} inactivos, ${results.rechazados} rechazados — Empresa: ${user.cod_empresa}`
        );

        return res.status(200).json({
            success: true,
            mensaje: 'Carga masiva completada',
            insertados: results.insertados,
            reactivados: results.reactivados,
            inactivos: results.inactivos,
            rechazados: results.rechazados,
            errores: results.errores
        });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error en carga masiva:', error);
        return res.status(500).json({ success: false, mensaje: 'Error del servidor en carga masiva' });
    }
};
