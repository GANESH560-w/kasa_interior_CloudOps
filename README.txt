Kasa Interiors Website + Admin Dashboard

Admin login:
Username: kasaadmin
Password: kasa@2025

How to change password:
1. Open admin/admin.js
2. Find ADMIN_USER and ADMIN_PASS near the top of the file
3. Replace the existing values with your new username and password
4. Save the file and refresh the admin login page

How to add projects and customers:
1. Open admin/customers.html in the browser and add customers from the Customers page
2. Open admin/projects.html and use the Add New Project form
3. Select the client from the client dropdown
4. Open a project from the Projects table to manage timeline, expenses, bills, documents, and customer info

How to replace video and images:
1. Replace assets/hero.mp4 to update the main website video
2. Replace assets/kasa-owner-img.jpg to update the owner photo
3. Replace assets/img1.png to update the fallback image
4. Replace or add portfolio videos in assets/ and update the PORTFOLIO_VIDEO_SOURCES list in main.js
5. Replace image URLs directly inside the HTML files if you want different gallery or service images

How to deploy to Netlify:
1. Zip the entire kasa-interiors folder
2. Log in to Netlify and choose Add new site > Deploy manually
3. Drag and drop the zip contents or the unzipped folder files into Netlify

Google Maps link used:
https://maps.app.goo.gl/CBrQezknYxY5t6wz5
