const poolInfoContacto = require('../../config/dbInfoContacto');
const { log_error } = require('../../log/logger')

const main = async (req, res) => {
  try {
    const result = await poolInfoContacto.query(`
      SELECT tipo
           , etiqueta
           , valor
           , icono 
        FROM info_contacto 
       WHERE activo = true 
       ORDER BY orden
    `);
    res.json({
      success : true,
      data    : result.rows
    });
  } catch (error) {
    console.error('Error obteniendo info contacto:', error);
    log_error.error('Error obteniendo info contacto:', error)
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información'
    });
  }
};

module.exports = { main };