const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { cod_solicitud, descripcion, observaciones, detalles, estado, cod_empresa_destino } = req.body;

        if (!cod_solicitud) {
            return res.status(400).json({ success: false, mensaje: 'Falta el código de solicitud' });
        }

        // Solo se puede editar si está en BORRADOR
        const checkQ = `SELECT estado FROM solicitudes_carga WHERE cod_solicitud = $1 AND cod_empresa = $2`;
        const checkR = await executeQueryWithSession(user, checkQ, [cod_solicitud, user.cod_empresa]);

        if (!checkR.success || checkR.data.length === 0) {
            return res.status(404).json({ success: false, mensaje: 'Solicitud no encontrada' });
        }
        if (checkR.data[0].estado !== 'B') {
            return res.status(400).json({ success: false, mensaje: 'Solo se pueden editar solicitudes en estado Borrador' });
        }

        // Si se proveen detalles, recalculamos totales
        let monto_total = 0;
        let cant_benef = 0;
        if (detalles && Array.isArray(detalles)) {
            monto_total = detalles.reduce((sum, d) => sum + (parseFloat(d.monto) || 0), 0);
            cant_benef = detalles.length;
        }

        const nuevo_estado = estado === 'P' ? 'P' : 'B';

        // Determinar destino (mantenemos cod_empresa)
        let finalDestino = user.cod_empresa;


        const updateResult = await executeQueryWithSession(user, `
            UPDATE solicitudes_carga
               SET descripcion = $1,
                   observaciones = $2,
                   estado = $5
                   ${detalles ? ', monto_solicitado = $4, cant_beneficiarios = $6' : ''}
             WHERE cod_solicitud = $3
        `, detalles
            ? [descripcion, observaciones, cod_solicitud, monto_total, nuevo_estado, cant_benef]
            : [descripcion, observaciones, cod_solicitud, null, nuevo_estado, null]);

        if (!updateResult.success) {
            return res.status(500).json({ success: false, mensaje: updateResult.mensaje || 'Error al actualizar cabecera' });
        }

        // Si hay detalles, borrar anteriores e insertar los nuevos
        if (detalles && Array.isArray(detalles)) {
            const deleteResult = await executeQueryWithSession(user, 'DELETE FROM solicitudes_carga_det WHERE cod_solicitud = $1', [cod_solicitud]);
            if (!deleteResult.success) {
                return res.status(500).json({ success: false, mensaje: 'Error al actualizar detalles (limpieza)' });
            }

            const insertDetQuery = `INSERT INTO solicitudes_carga_det (cod_solicitud, cod_beneficiario, monto) VALUES ($1, $2, $3)`;
            for (const det of detalles) {
                const detRes = await executeQueryWithSession(user, insertDetQuery, [cod_solicitud, det.cod_beneficiario, det.monto]);
                if (!detRes.success) {
                    return res.status(500).json({ success: false, mensaje: `Error al insertar beneficiario ${det.cod_beneficiario}` });
                }
            }
        }

        return res.status(200).json({ success: true, mensaje: 'Solicitud actualizada correctamente' });

    } catch (error) {
        log_error.error('Error actualizando solicitud:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error al actualizar la solicitud',
            error: error.message
        });
    }
};
