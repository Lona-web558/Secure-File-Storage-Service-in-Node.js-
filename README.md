# Secure-File-Storage-Service-in-Node.js-
Secure File Storage Service in Node.js 


# Secure File Storage Service

A Node.js-based secure file storage service with user authentication, file upload/download, and management capabilities using **only built-in Node.js modules** (no external dependencies like Express).

## Features

- User registration and authentication
- Secure password hashing (SHA-256)
- Token-based session management
- File upload with size limits (10MB)
- File download
- File deletion
- User-specific file storage
- File metadata tracking
- RESTful API
- **Zero external dependencies - uses only Node.js built-in modules**

## Built-In Modules Used

- **http**: HTTP server
- **fs**: File system operations
- **crypto**: Password hashing and token generation
- **path**: Path handling
- **url**: URL parsing
- **querystring**: Query string parsing

## Installation

No installation needed! Just Node.js is required.

## Running the Server

Start the server:
```bash
node server.js
```

The server will run on http://localhost:3000

## Usage

### Web Interface

1. Open your browser and navigate to http://localhost:3000
2. Register a new account or login with existing credentials
3. Upload files using the file input
4. View your uploaded files
5. Download or delete files as needed

### API Endpoints

#### Authentication

**Register a new user:**
```
POST /api/register
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

**Login:**
```
POST /api/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}

Response: { "token": "...", "username": "..." }
```

**Logout:**
```
POST /api/logout
Authorization: Bearer {token}
```

#### File Operations

**Upload a file:**
```
POST /api/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

FormData: file
```

**List all files:**
```
GET /api/files
Authorization: Bearer {token}
```

**Download a file:**
```
GET /api/download/{fileId}
Authorization: Bearer {token}
```

**Delete a file:**
```
DELETE /api/files/{fileId}
Authorization: Bearer {token}
```

**Get user information:**
```
GET /api/user
Authorization: Bearer {token}
```

## Project Structure

```
secure-file-storage/
├── server.js           # Main server file (uses only built-in modules)
├── users.json          # User database (auto-created)
├── public/
│   └── index.html     # Web interface
└── uploads/           # File storage directory (auto-created)
    └── {username}/    # User-specific directories
```

## Technical Details

### Traditional JavaScript Syntax

This project uses traditional JavaScript syntax:
- `var` declarations (no `const` or `let`)
- Function declarations (no arrow functions)
- Traditional function expressions
- Compatible with older Node.js versions

### Security Features

- Password hashing using crypto module (SHA-256)
- Token-based authentication
- User-isolated file storage
- File size limits (10MB)
- Session management
- Multipart form data parsing (manual implementation)

### Custom Multipart Parser

Since we're not using any external modules like `multer` or `express`, the server includes a custom implementation of multipart form data parsing to handle file uploads directly.

## How It Works

1. **HTTP Server**: Uses Node.js built-in `http` module to create the server
2. **Routing**: Manual routing based on URL pathname and HTTP method
3. **File Upload**: Custom multipart form parser to handle file uploads
4. **Authentication**: Token-based with in-memory session storage
5. **File Storage**: Files stored in user-specific directories
6. **Data Persistence**: User data stored in JSON file

## Security Notes

**For Production Use:**

1. Replace the simple session storage with Redis or a proper session store
2. Replace the JSON file storage with a real database (MongoDB, PostgreSQL, etc.)
3. Add HTTPS support
4. Implement rate limiting
5. Add CSRF protection
6. Use stronger password hashing (bcrypt instead of SHA-256)
7. Add input validation and sanitization
8. Implement proper error handling
9. Add logging
10. Set up environment variables for configuration
11. Add request size limits

## Limitations

- Sessions are stored in memory (will be lost on restart)
- User data is stored in a JSON file (not suitable for production)
- Simple SHA-256 hashing (use bcrypt for production)
- No email verification
- No password recovery
- Basic error handling
- No external dependencies means more manual implementation

## Why No External Dependencies?

This implementation uses only Node.js built-in modules to demonstrate:
- How web servers work at a fundamental level
- Manual implementation of common web server features
- Understanding of HTTP protocol and multipart form data
- Traditional JavaScript coding practices

For production applications, using frameworks like Express and proper security libraries is recommended.

## License

ISC
