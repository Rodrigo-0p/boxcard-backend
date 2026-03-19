const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const cod_empresa = user.cod_empresa;

        // 1. Asegurar que la empresa tiene un límite asignado para la prueba
        await executeQueryWithSession(user, `
      UPDATE empresas SET limite_credito = 50000000 WHERE cod_empresa = $1
    `, [cod_empresa]);

        // 2. Insertar Beneficiarios de Prueba
        const testData = [
            ['777001', 'Juan Pérez', 'juan.perez@email.com', '0981111222', 'A'],
            ['777002', 'Ma. Auxiliadora Benitez', 'm.benitez@email.com', '0972333444', 'A'],
            ['777003', 'Carlos Rodriguez', 'c.rod@email.com', '0985555666', 'P'],
            ['777004', 'Elena Villalba', 'elena.v@email.com', '0991777888', 'A'],
            ['777005', 'Ricardo Galeano', 'rgaleano@email.com', '0981999000', 'I']
        ];

        let count = 0;
        for (const row of testData) {
            const [doc, nombre, correo, telef, estado] = row;

            // Solo insertar si no existe
            const exist = await executeQueryWithSession(user, 'SELECT 1 FROM nominas_benef WHERE nro_documento = $1 AND cod_empresa = $2', [doc, cod_empresa]);

            if (exist.data.length === 0) {
                await executeQueryWithSession(user, `
          INSERT INTO nominas_benef (cod_empresa, nro_documento, nombre_completo, correo, nro_telef, estado, fecha_alta, usuario_alta)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'SEMILLA')
        `, [cod_empresa, doc, nombre, correo, telef, estado]);
                count++;
            }
        }

        return res.status(200).json({
            success: true,
            mensaje: `Semilla ejecutada. Se insertaron ${count} registros de prueba. Límite de empresa actualizado a 50.000.000.`
        });

    } catch (error) {
        log_error.error('Error en seed:', error);
        return res.status(500).json({ success: false, mensaje: error.message });
    }
};
