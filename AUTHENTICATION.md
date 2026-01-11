# Authentication System

## Production-Ready JWT Authentication

The application now uses a secure JWT-based authentication system for admin access, replacing the previous shared-secret approach.

### Key Features

- **JWT Tokens**: Secure token-based authentication with access and refresh tokens
- **Password Hashing**: Passwords are hashed using bcrypt with 10 salt rounds
- **HTTP-Only Cookies**: Tokens are stored in HTTP-only cookies, preventing XSS attacks
- **Token Expiration**: Access tokens expire after 15 minutes, refresh tokens after 7 days
- **Database-Backed Users**: Admin users are stored in the database with activation status

### Default Credentials (Development Only)

```
Email: admin@redember.com
Password: admin123
```

**⚠️ IMPORTANT: Change these credentials in production!**

### API Endpoints

#### POST /api/auth/login

Login with email and password.

**Request:**

```json
{
  "email": "admin@redember.com",
  "password": "admin123"
}
```

**Response:**

```json
{
  "message": "Login successful",
  "user": {
    "id": "...",
    "email": "admin@redember.com",
    "name": "Admin User"
  }
}
```

Sets HTTP-only cookies: `accessToken` and `refreshToken`

#### POST /api/auth/refresh

Refresh the access token using the refresh token.

**Response:**

```json
{
  "message": "Token refreshed",
  "user": {
    "id": "...",
    "email": "admin@redember.com"
  }
}
```

Updates the `accessToken` cookie.

#### POST /api/auth/logout

Logout and clear authentication cookies.

**Response:**

```json
{
  "message": "Logged out successfully"
}
```

#### GET /api/auth/me

Get current authenticated user information.

**Response:**

```json
{
  "user": {
    "id": "...",
    "email": "admin@redember.com",
    "name": "Admin User"
  }
}
```

### Environment Variables

Add these to your `.env` file:

```env
JWT_SECRET=your-very-secure-jwt-secret-key-change-in-production
JWT_REFRESH_SECRET=your-very-secure-refresh-secret-key-change-in-production
```

**Generate secure secrets for production:**

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 32
```

### Protected Routes

All admin routes require authentication via JWT:

- GET /api/admin/inventory
- GET /api/admin/orders
- GET /api/admin/groups
- POST /api/admin/groups
- PUT /api/admin/groups/:id
- DELETE /api/admin/groups/:id
- GET /api/admin/products
- POST /api/admin/products
- PUT /api/admin/products/:id
- DELETE /api/admin/products/:id
- POST /api/admin/upload

### Frontend Login

Navigate to `/admin/login` to access the login page. After successful authentication, you'll be redirected to the admin dashboard.

The sidebar displays the authenticated user's name and email, with a logout button.

### Security Best Practices

1. **Change Default Credentials**: Immediately change the default admin password in production
2. **Use Strong Secrets**: Generate cryptographically secure JWT secrets
3. **HTTPS Only**: Always use HTTPS in production to protect cookies from interception
4. **Regular Token Rotation**: The system automatically rotates access tokens via the refresh mechanism
5. **Monitor Login Attempts**: Consider implementing rate limiting and login attempt monitoring

### Database Schema

The `AdminUser` model stores admin accounts:

```prisma
model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([email])
}
```

### Creating New Admin Users

To create a new admin user, add them to the database with a hashed password:

```javascript
import bcrypt from "bcrypt";
import { prisma } from "./src/db.js";

const password = "your-secure-password";
const passwordHash = await bcrypt.hash(password, 10);

await prisma.adminUser.create({
  data: {
    email: "newadmin@redember.com",
    passwordHash,
    name: "New Admin",
    active: true,
  },
});
```

Or update the seed script in `server/prisma/seed.js` to add more users.

### Migration from Old System

The previous shared-secret authentication (`ADMIN_TOKEN` environment variable) has been completely replaced. If you have old code references:

1. Remove `ADMIN_TOKEN` from `.env`
2. Remove any frontend code using `x-admin-token` header
3. Update any API clients to include `credentials: 'include'` in fetch calls
4. Users must now log in via `/admin/login` instead of entering a token

### Troubleshooting

**Issue**: "Unauthorized" errors when accessing admin routes
**Solution**: Ensure you're logged in and cookies are being sent with requests

**Issue**: Tokens expire too quickly
**Solution**: Adjust `ACCESS_TOKEN_EXPIRY` in `server/src/auth/jwt.js`

**Issue**: CORS errors in development
**Solution**: Ensure `credentials: true` is set in the CORS configuration in `server/src/index.js`

**Issue**: Cannot log in
**Solution**: Verify the database has the admin user (run `npm run seed` in server directory)
