const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
const moment = require('moment');

/**
 * Pre-valida beneficiarios ANTES del INSERT masivo (no modifica BD).
 *
 * Lógica por fila:
 *  - Campos vacíos           → error
 *  - Activo en esta empresa  → error  (ya existe activo)
 *  - Inactivo en esta empresa → warn  (se reactivará con datos actualizados)
 *  - Activo en otra empresa  → warn  (se insertará/reactivará como Inactivo)
 *  - No existe               → ok    (se insertará como nuevo Activo)
 *  - Duplicado en el archivo → error
 */
exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { beneficiarios } = req.body;

        if (!beneficiarios || !Array.isArray(beneficiarios) || beneficiarios.length === 0) {
            return res.status(400).json({ success: false, mensaje: 'Se requiere un array de beneficiarios' });
        }

        const resultados = [];

        for (let i = 0; i < beneficiarios.length; i++) {
            const b = beneficiarios[i];
            const fila = i + 2; // +2: fila 1 = encabezado, i comienza en 0

            const item = {
                fila,
                nro_documento: b.nro_documento || '',
                ruc: b.ruc || '',
                nombre_completo: b.nombre_completo || '',
                correo: b.correo || '',
                nro_telef: b.nro_telef || '',
                monto_limite: parseFloat(b.monto_limite) || 0,
                status: 'ok',
                tipo_alerta: null,
                errores: [],
            };

            // ── Campos obligatorios ──────────────────────────────────────
            if (!b.nro_documento) item.errores.push('Documento vacío');
            if (!b.nombre_completo) item.errores.push('Nombre vacío');

            if (item.errores.length > 0) {
                item.status = 'error';
                resultados.push(item);
                continue;
            }

            try {
                // ── 1. ¿Existe en ESTA empresa? ─────────────────────────
                const existeQuery = `
                    SELECT estado FROM nominas_benef
                     WHERE nro_documento = $1 AND cod_empresa = $2
                     LIMIT 1
                `;
                const existeResult = await executeQueryWithSession(user, existeQuery, [b.nro_documento, user.cod_empresa]);

                if (existeResult.success && existeResult.data.length > 0) {
                    const estado = existeResult.data[0].estado;

                    if (estado === 'A') {
                        // Activo → no se puede volver a cargar
                        item.status = 'error';
                        item.tipo_alerta = 'duplicado_empresa';
                        item.errores.push('Ya existe y está activo en esta empresa');
                        resultados.push(item);
                        continue;
                    } else {
                        // Inactivo → se reactivará con datos nuevos
                        item.status = 'warn';
                        item.tipo_alerta = 'existente_inactivo';
                        item.errores.push('Está inactivo en esta empresa — se reactivará y sus datos serán actualizados');
                        resultados.push(item);
                        continue;
                    }
                }

                // ── 2. ¿Activo en OTRA empresa? ─────────────────────────
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
                if (otraResult.success && otraResult.data.length > 0) {
                    item.status = 'warn';
                    item.tipo_alerta = 'activo_otra_empresa';
                    item.errores.push(
                        `Ya activo en "${otraResult.data[0].empresa_nombre}". ` +
                        'Se registrará como Inactivo en esta empresa.'
                    );
                    resultados.push(item);
                    continue;
                }

            } catch (rowErr) {
                item.status = 'error';
                item.errores.push(rowErr.message || 'Error de consulta');
            }

            resultados.push(item);
        }

        // ── Duplicados DENTRO del mismo archivo ──────────────────────────
        const docCounts = {};
        resultados.forEach(r => {
            if (r.nro_documento) docCounts[r.nro_documento] = (docCounts[r.nro_documento] || 0) + 1;
        });
        resultados.forEach(r => {
            if (docCounts[r.nro_documento] > 1 && r.status !== 'error') {
                r.status = 'error';
                r.tipo_alerta = 'duplicado_archivo';
                r.errores.push('Documento repetido en el archivo');
            }
        });

        const totales = {
            total: resultados.length,
            ok: resultados.filter(r => r.status === 'ok').length,
            warn: resultados.filter(r => r.status === 'warn').length,
            error: resultados.filter(r => r.status === 'error').length,
        };

        return res.status(200).json({ success: true, data: resultados, totales });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error en prevalidación:', error);
        return res.status(500).json({ success: false, mensaje: 'Error del servidor en prevalidación' });
    }
};
