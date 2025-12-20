const app  = require('./app');
const path = require('path');
require('dotenv').config({path:path.join(__dirname,'..','.env'),quiet: true});
app.set('port', process.env.PORT || 8000);

app.listen(app.get('port'), () => {
  console.log(`El servidor se está ejecutando http://${process.env.DB_HOST}:${app.get('port')}`);
});