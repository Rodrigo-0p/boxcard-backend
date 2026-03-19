const { executeQueryWithSession } = require('../../../../config/database');
const { log_error, log_info } = require('../../../../log/logger');
const moment = require('moment');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const {
            nro_documento,
            ruc,
            nombre_completo,
            correo,
            nro_telef,
            monto_limite,
        } = req.body;

        // ── Validaciones básicas ──────────────────────────────────────
        if (!nro_documento || !nombre_completo) {
            return res.status(400).json({
                success: false,
                mensaje: 'Nro de documento y nombre completo son requeridos'
            });
        }

        // ── Regla multi-empresa: no puede estar ACTIVO en otra empresa ─
        const checkOtraEmpresaQuery = `
            SELECT e.nombre AS empresa_nombre
              FROM nominas_benef b
              JOIN empresas e ON b.cod_empresa = e.cod_empresa
             WHERE b.nro_documento = $1
               AND b.estado = 'A'
               AND b.cod_empresa != $2
             LIMIT 1
        `;
        const otraEmpresaResult = await executeQueryWithSession(user, checkOtraEmpresaQuery, [nro_documento, user.cod_empresa]);
        if (otraEmpresaResult.success && otraEmpresaResult.data.length > 0) {
            return res.status(400).json({
                success: false,
                mensaje: `Esta persona ya está activa en la empresa "${otraEmpresaResult.data[0].empresa_nombre}". No puede estar activa en dos empresas simultáneamente.`
            });
        }

        // ── Verificar si ya existe en ESTA empresa ─────────────────────
        const existeQuery = `
            SELECT cod_beneficiario, estado
              FROM nominas_benef
             WHERE nro_documento = $1 AND cod_empresa = $2
             LIMIT 1
        `;
        const existeResult = await executeQueryWithSession(user, existeQuery, [nro_documento, user.cod_empresa]);

        if (existeResult.success && existeResult.data.length > 0) {
            const reg = existeResult.data[0];

            if (reg.estado === 'A') {
                // Ya activo en esta empresa → error
                return res.status(400).json({
                    success: false,
                    mensaje: 'Esta persona ya está registrada y activa en tu nómina'
                });
            }

            // Existe pero Inactivo → reactivar y actualizar datos
            const updateQuery = `
                UPDATE nominas_benef
                   SET nombre_completo = $1
                     , ruc             = $2
                     , correo          = $3
                     , nro_telef       = $4
                     , monto_limite    = $5
                     , estado          = 'A'
                     , fecha_mod       = NOW()
                     , usuario_mod     = $6
                 WHERE cod_beneficiario = $7
                   AND cod_empresa      = $8
            `;
            const updateParams = [
                nombre_completo,
                ruc || null,
                correo || null,
                nro_telef || null,
                monto_limite ?? 0,
                user.username || 'SISTEMA',
                reg.cod_beneficiario,
                user.cod_empresa
            ];
            const updateResult = await executeQueryWithSession(user, updateQuery, updateParams);

            if (!updateResult.success) {
                return res.status(500).json({ success: false, mensaje: 'Error al reactivar beneficiario' });
            }

            log_info.info(`Beneficiario reactivado: ${nro_documento} - ${nombre_completo} - Empresa: ${user.cod_empresa} - User: ${user.username}`);
            return res.status(200).json({
                success: true,
                mensaje: 'Beneficiario reactivado y datos actualizados exitosamente',
                data: { cod_beneficiario: reg.cod_beneficiario }
            });
        }

        // ── No existe → INSERT nuevo ───────────────────────────────────
        const insertQuery = `
            INSERT INTO nominas_benef (
                cod_empresa, nro_documento, ruc, nombre_completo,
                correo, nro_telef, monto_limite, estado, fecha_alta, usuario_alta
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, 'A', NOW(), $8
            ) RETURNING cod_beneficiario
        `;
        const insertParams = [
            user.cod_empresa,
            nro_documento,
            ruc || null,
            nombre_completo,
            correo || null,
            nro_telef || null,
            monto_limite ?? 0,
            user.username || 'SISTEMA'
        ];
        const insertResult = await executeQueryWithSession(user, insertQuery, insertParams);

        if (!insertResult.success) {
            return res.status(500).json({ success: false, mensaje: insertResult.message || 'Error al registrar beneficiario' });
        }

        log_info.info(`Beneficiario creado: ${nro_documento} - ${nombre_completo} - Empresa: ${user.cod_empresa} - User: ${user.username}`);
        return res.status(200).json({
            success: true,
            mensaje: 'Beneficiario registrado exitosamente',
            data: { cod_beneficiario: insertResult.data[0]?.cod_beneficiario }
        });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error creando beneficiario:', error);
        return res.status(500).json({ success: false, mensaje: 'Error del servidor al registrar beneficiario' });
    }
};
