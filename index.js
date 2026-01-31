var http = require('http');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var url = require('url');
var querystring = require('querystring');

var PORT = 3000;

// Create necessary directories
var uploadsDir = path.join(__dirname, 'uploads');
var publicDir = path.join(__dirname, 'public');
var usersFile = path.join(__dirname, 'users.json');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify({}));
}

// User storage functions
function getUsers() {
    try {
        var data = fs.readFileSync(usersFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

function saveUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Password hashing
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate secure token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Session storage
var sessions = {};

// Parse multipart form data for file uploads
function parseMultipart(req, callback) {
    var boundary = '';
    var contentType = req.headers['content-type'] || '';
    
    var boundaryMatch = contentType.match(/boundary=(.+)/);
    if (boundaryMatch) {
        boundary = '--' + boundaryMatch[1];
    }
    
    var chunks = [];
    
    req.on('data', function(chunk) {
        chunks.push(chunk);
    });
    
    req.on('end', function() {
        var buffer = Buffer.concat(chunks);
        var parts = [];
        var position = 0;
        
        while (position < buffer.length) {
            var boundaryPos = buffer.indexOf(boundary, position);
            if (boundaryPos === -1) break;
            
            var nextBoundaryPos = buffer.indexOf(boundary, boundaryPos + boundary.length);
            if (nextBoundaryPos === -1) {
                nextBoundaryPos = buffer.length;
            }
            
            var part = buffer.slice(boundaryPos + boundary.length, nextBoundaryPos);
            
            var headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
                var headers = part.slice(0, headerEnd).toString();
                var content = part.slice(headerEnd + 4);
                
                // Remove trailing \r\n
                if (content.length >= 2 && content[content.length - 2] === 13 && content[content.length - 1] === 10) {
                    content = content.slice(0, -2);
                }
                
                var nameMatch = headers.match(/name="([^"]+)"/);
                var filenameMatch = headers.match(/filename="([^"]+)"/);
                var contentTypeMatch = headers.match(/Content-Type: (.+)/);
                
                if (nameMatch) {
                    var partData = {
                        name: nameMatch[1],
                        content: content
                    };
                    
                    if (filenameMatch) {
                        partData.filename = filenameMatch[1];
                        partData.mimetype = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
                    } else {
                        partData.content = content.toString('utf8');
                    }
                    
                    parts.push(partData);
                }
            }
            
            position = nextBoundaryPos;
        }
        
        callback(parts);
    });
}

// Parse JSON body
function parseJSON(req, callback) {
    var body = '';
    
    req.on('data', function(chunk) {
        body += chunk.toString();
    });
    
    req.on('end', function() {
        try {
            var data = JSON.parse(body);
            callback(null, data);
        } catch (error) {
            callback(error, null);
        }
    });
}

// Send JSON response
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// Send file
function sendFile(res, filePath, contentType) {
    fs.readFile(filePath, function(err, data) {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// Get authentication token from request
function getAuthToken(req) {
    var authorization = req.headers['authorization'];
    if (!authorization) return null;
    
    return authorization.replace('Bearer ', '');
}

// Authenticate request
function authenticate(req, res, callback) {
    var token = getAuthToken(req);
    
    if (!token || !sessions[token]) {
        sendJSON(res, 401, { error: 'Authentication required' });
        return false;
    }
    
    callback(sessions[token]);
    return true;
}

// Format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Create HTTP server
var server = http.createServer(function(req, res) {
    var parsedUrl = url.parse(req.url, true);
    var pathname = parsedUrl.pathname;
    var method = req.method;
    
    console.log(method + ' ' + pathname);
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Serve static files
    if (pathname === '/' || pathname === '/index.html') {
        sendFile(res, path.join(publicDir, 'index.html'), 'text/html');
        return;
    }
    
    // API Routes
    
    // Register
    if (pathname === '/api/register' && method === 'POST') {
        parseJSON(req, function(err, data) {
            if (err || !data) {
                sendJSON(res, 400, { error: 'Invalid request' });
                return;
            }
            
            var username = data.username;
            var password = data.password;
            
            if (!username || !password) {
                sendJSON(res, 400, { error: 'Username and password required' });
                return;
            }
            
            if (username.length < 3 || password.length < 6) {
                sendJSON(res, 400, { 
                    error: 'Username must be at least 3 characters and password at least 6 characters' 
                });
                return;
            }
            
            var users = getUsers();
            
            if (users[username]) {
                sendJSON(res, 400, { error: 'Username already exists' });
                return;
            }
            
            users[username] = {
                password: hashPassword(password),
                files: []
            };
            
            saveUsers(users);
            sendJSON(res, 200, { message: 'User registered successfully' });
        });
        return;
    }
    
    // Login
    if (pathname === '/api/login' && method === 'POST') {
        parseJSON(req, function(err, data) {
            if (err || !data) {
                sendJSON(res, 400, { error: 'Invalid request' });
                return;
            }
            
            var username = data.username;
            var password = data.password;
            
            if (!username || !password) {
                sendJSON(res, 400, { error: 'Username and password required' });
                return;
            }
            
            var users = getUsers();
            var user = users[username];
            
            if (!user || user.password !== hashPassword(password)) {
                sendJSON(res, 401, { error: 'Invalid credentials' });
                return;
            }
            
            var token = generateToken();
            sessions[token] = {
                username: username,
                loginTime: new Date().toISOString()
            };
            
            sendJSON(res, 200, { 
                message: 'Login successful',
                token: token,
                username: username
            });
        });
        return;
    }
    
    // Logout
    if (pathname === '/api/logout' && method === 'POST') {
        var token = getAuthToken(req);
        if (token) {
            delete sessions[token];
        }
        sendJSON(res, 200, { message: 'Logged out successfully' });
        return;
    }
    
    // Upload file
    if (pathname === '/api/upload' && method === 'POST') {
        authenticate(req, res, function(session) {
            parseMultipart(req, function(parts) {
                var filePart = null;
                
                for (var i = 0; i < parts.length; i++) {
                    if (parts[i].filename) {
                        filePart = parts[i];
                        break;
                    }
                }
                
                if (!filePart) {
                    sendJSON(res, 400, { error: 'No file uploaded' });
                    return;
                }
                
                // Check file size (10MB limit)
                if (filePart.content.length > 10 * 1024 * 1024) {
                    sendJSON(res, 400, { error: 'File too large (max 10MB)' });
                    return;
                }
                
                var userDir = path.join(uploadsDir, session.username);
                if (!fs.existsSync(userDir)) {
                    fs.mkdirSync(userDir);
                }
                
                var uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                var filename = uniqueSuffix + '-' + filePart.filename;
                var filepath = path.join(userDir, filename);
                
                fs.writeFileSync(filepath, filePart.content);
                
                var users = getUsers();
                var user = users[session.username];
                
                var fileInfo = {
                    id: crypto.randomBytes(16).toString('hex'),
                    originalName: filePart.filename,
                    filename: filename,
                    size: filePart.content.length,
                    uploadDate: new Date().toISOString(),
                    mimetype: filePart.mimetype
                };
                
                user.files.push(fileInfo);
                saveUsers(users);
                
                sendJSON(res, 200, { 
                    message: 'File uploaded successfully',
                    file: fileInfo
                });
            });
        });
        return;
    }
    
    // List files
    if (pathname === '/api/files' && method === 'GET') {
        authenticate(req, res, function(session) {
            var users = getUsers();
            var user = users[session.username];
            
            sendJSON(res, 200, { files: user.files || [] });
        });
        return;
    }
    
    // Download file
    if (pathname.startsWith('/api/download/') && method === 'GET') {
        authenticate(req, res, function(session) {
            var fileId = pathname.split('/')[3];
            var users = getUsers();
            var user = users[session.username];
            
            var fileInfo = null;
            for (var i = 0; i < user.files.length; i++) {
                if (user.files[i].id === fileId) {
                    fileInfo = user.files[i];
                    break;
                }
            }
            
            if (!fileInfo) {
                sendJSON(res, 404, { error: 'File not found' });
                return;
            }
            
            var filePath = path.join(uploadsDir, session.username, fileInfo.filename);
            
            if (!fs.existsSync(filePath)) {
                sendJSON(res, 404, { error: 'File not found on disk' });
                return;
            }
            
            fs.readFile(filePath, function(err, data) {
                if (err) {
                    sendJSON(res, 500, { error: 'Error reading file' });
                    return;
                }
                
                res.writeHead(200, {
                    'Content-Type': fileInfo.mimetype || 'application/octet-stream',
                    'Content-Disposition': 'attachment; filename="' + fileInfo.originalName + '"',
                    'Content-Length': data.length
                });
                res.end(data);
            });
        });
        return;
    }
    
    // Delete file
    if (pathname.startsWith('/api/files/') && method === 'DELETE') {
        authenticate(req, res, function(session) {
            var fileId = pathname.split('/')[3];
            var users = getUsers();
            var user = users[session.username];
            
            var fileIndex = -1;
            for (var i = 0; i < user.files.length; i++) {
                if (user.files[i].id === fileId) {
                    fileIndex = i;
                    break;
                }
            }
            
            if (fileIndex === -1) {
                sendJSON(res, 404, { error: 'File not found' });
                return;
            }
            
            var fileInfo = user.files[fileIndex];
            var filePath = path.join(uploadsDir, session.username, fileInfo.filename);
            
            // Delete physical file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            // Remove from user's file list
            user.files.splice(fileIndex, 1);
            saveUsers(users);
            
            sendJSON(res, 200, { message: 'File deleted successfully' });
        });
        return;
    }
    
    // Get user info
    if (pathname === '/api/user' && method === 'GET') {
        authenticate(req, res, function(session) {
            var users = getUsers();
            var user = users[session.username];
            
            var totalSize = 0;
            for (var i = 0; i < user.files.length; i++) {
                totalSize += user.files[i].size;
            }
            
            sendJSON(res, 200, {
                username: session.username,
                fileCount: user.files.length,
                totalSize: totalSize
            });
        });
        return;
    }
    
    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, function() {
    console.log('='.repeat(60));
    console.log('Secure File Storage Service');
    console.log('='.repeat(60));
    console.log('Server running on http://localhost:' + PORT);
    console.log('');
    console.log('API Endpoints:');
    console.log('  POST   /api/register         - Register new user');
    console.log('  POST   /api/login            - Login');
    console.log('  POST   /api/logout           - Logout');
    console.log('  POST   /api/upload           - Upload file');
    console.log('  GET    /api/files            - List files');
    console.log('  GET    /api/download/:fileId - Download file');
    console.log('  DELETE /api/files/:fileId    - Delete file');
    console.log('  GET    /api/user             - Get user info');
    console.log('='.repeat(60));
});
