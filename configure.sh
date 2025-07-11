echo "
  <VirtualHost *:80>
      ServerName 13.51.206.244
      Redirect / https://13.51.206.244
  </VirtualHost> 
      
  <VirtualHost  *:443>
      
      ServerName 13.51.206.244
      SSLEngine on
      SSLProxyEngine On
      SSLCertificateFile      /etc/ssl/certs/ssl-cert-snakeoil.pem
      SSLCertificateKeyFile /etc/ssl/private/ssl-cert-snakeoil.key
      
      ProxyRequests     Off
      ProxyPreserveHost On
      #AllowEncodedSlashes NoDecode
      <Proxy *>
          Order deny,allow
          Allow from all
      </Proxy>
      
      ProxyPass         /_stcore        ws://localhost:8501/_stcore
      ProxyPassReverse  /_stcore        ws://localhost:8501/_stcore
      
      # The order is important here
      ProxyPass         /        http://localhost:8501/
      ProxyPassReverse  /        http://localhost:8501/
      
  </VirtualHost>" > /etc/apache2/sites-available/deploy_attendance_app.conf