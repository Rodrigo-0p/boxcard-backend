const { executeQueryWithSession } = require('../../../../config/database');
const { log_error, log_info } = require('../../../../log/logger');
const moment = require('moment');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { descripcion, observaciones, detalles, estado, cod_empresa_destino: destinoBody } = req.body;

        if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
            return res.status(400).json({ success: false, mensaje: 'Se requieren detalles de beneficiarios' });
        }

        const monto_total = detalles.reduce((sum, d) => sum + (parseFloat(d.monto) || 0), 0);
        const cant_benef = detalles.length;
        const v_estado = estado === 'P' ? 'P' : 'B';

        // 0. Buscar empresa destino (Proveedor con es_proveedor = 'S')
        const provQuery = `SELECT cod_empresa FROM empresas WHERE es_proveedor = 'S' LIMIT 1`;
        const provResult = await executeQueryWithSession(user, provQuery, []);

        if (!provResult.success || provResult.data.length === 0) {
            return res.status(400).json({
                success: false,
                mensaje: 'Ninguna empresa está configurada como proveedor de servicios.'
            });
        }
        const cod_empresa_destino = provResult.data[0].cod_empresa;

        // 1. Obtener próximo nro_solicitud (secuencial por empresa)
        const nroResult = await executeQueryWithSession(user,
            'SELECT COALESCE(MAX(nro_solicitud), 0) + 1 as next_nro FROM solicitudes_carga WHERE cod_empresa = $1',
            [user.cod_empresa]
        );
        const nro_solicitud = nroResult.data[0].next_nro;


        // 3. Insertar Cabecera
        const insertCabQuery = `
          INSERT INTO solicitudes_carga (
            cod_empresa, nro_solicitud, descripcion, observaciones, 
            monto_solicitado, cant_beneficiarios, estado, 
            usuario_creacion, fecha_creacion, cod_empresa_destino
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
          RETURNING cod_solicitud
        `;

        const cabResult = await executeQueryWithSession(user, insertCabQuery, [
            user.cod_empresa, nro_solicitud, descripcion, observaciones,
            monto_total, cant_benef, v_estado, user.username, cod_empresa_destino
        ]);

        if (!cabResult.success) throw new Error('Error al crear cabecera');
        const cod_solicitud = cabResult.data[0].cod_solicitud;

        // 4. Validación de límites desactivada (columnas eliminadas por el usuario)


        // 5. Insertar Detalles
        const insertDetQuery = `
          INSERT INTO solicitudes_carga_det (cod_solicitud, cod_beneficiario, monto)
          VALUES ($1, $2, $3)
        `;

        for (const det of detalles) {
            const detRes = await executeQueryWithSession(user, insertDetQuery, [cod_solicitud, det.cod_beneficiario, det.monto]);
            if (!detRes.success) {
                // Si falla un detalle, informar del error
                return res.status(500).json({ success: false, mensaje: `Error al registrar beneficiario ${det.cod_beneficiario}` });
            }
        }

        return res.status(200).json({
            success: true,
            mensaje: 'Solicitud creada exitosamente',
            data: { cod_solicitud, nro_solicitud }
        });

    } catch (error) {
        log_error.error('Error creando solicitud:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error al registrar la solicitud',
            error: error.message
        });
    }
};
