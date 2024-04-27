# Update package lists
sudo apt update

# Install Node.js and npm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
source ~/.bashrc

nvm install v19

# Install PM2 globally
sudo npm install -g pm2

# Install Apache2
sudo apt-get install -y apache2

# Install Certbot for Apache
sudo apt-get install -y certbot python3-certbot-apache

sudo a2enmod proxy proxy_http proxy_balancer lbmethod_byrequests

sudo apt-get install -y chromium-browser libgbm-dev

# Restart Apache
sudo systemctl restart apache2

echo "Installation completed successfully!"