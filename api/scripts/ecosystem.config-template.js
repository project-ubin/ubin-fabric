module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps : [
    {
      name      : 'Ubin Fabric API',
      script    : '../app.js',
      args      : 'ORG_BIC',
      env: {
        GOPATH: '/home/azureuser'
      },
      error_file: '../logs/err.log',
      out_file  : '../logs/out.log',
      log_file  : '../logs/app.log',
      log_date_format   : 'YYYY-MM-DD HH:mm Z'
    }
  ]

};