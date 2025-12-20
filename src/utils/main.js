

// ========================================
// FUNCIÓN: LIMPIAR NÚMERO DE DOCUMENTO
// ========================================
exports.cleanDocumentNumber = (documento) => {
  if (!documento) return '';
  // Elimina solo -
  return documento.toString().replace(/-/g, '');
  // Elimina solo *, -, / y .
  // return documento.toString().replace(/[*\-\/.]/g, '');
};

// ===========================================================
// FUNCIÓN: DATOS NULL OR UNDEFINED, REMPLAZA POR DEFAULTVALUE
// ===========================================================
exports.nvl = (value, defaultValue)=> {
  return (value !== null && value !== undefined && value !== "") ? value : defaultValue;
}