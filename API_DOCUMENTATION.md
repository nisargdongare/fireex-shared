# FireEx Backend API Documentation

**Version:** 1.0.0  
**Last Updated:** 2026-10-08  
**Status:** ✅ Production Ready

## Overview

Complete REST API for FireEx fire safety management system with:
- OTP-based authentication
- JWT token management (access + refresh)
- Multi-organization user support
- Device management by organization and floor/room
- Role-based access control

## Base URL

- **Development:** `http://localhost:4000`
- **Production:** `https://api.fireex.com`

## Authentication

All protected endpoints require JWT Bearer token in Authorization header:

```bash
Authorization: Bearer <access_token>
```

### JWT Token Structure

```json
{
  "sub": "user_id",
  "mobileNumber": "8888888888",
  "appRole": "user|serviceBody",
  "organizations": [
    {
      "_id": "org_id_1",
      "name": "Organization Name"
    }
  ],
  "iat": 1728478813,
  "exp": 1728479713,
  "aud": "fireex-clients",
  "iss": "fireex-backend"
}
```

## API Endpoints

### Authentication Endpoints

#### 1. Request OTP
```
POST /api/auth/otp/request
```

**Authentication:** ❌ Not required

**Request Body:**
```json
{
  "mobileNumber": "8888888888"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully. Check your SMS."
}
```

**Error Responses:**
- `400`: VALIDATION_ERROR - Invalid mobile number format
- `404`: PHONE_NOT_REGISTERED - Mobile number not registered

---

#### 2. Verify OTP & Login
```
POST /api/auth/otp/verify
```

**Authentication:** ❌ Not required

**Request Body:**
```json
{
  "mobileNumber": "8888888888",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "mobileNumber": "8888888888",
      "appRole": "user",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "address": "123 Main Street",
      "city": "New Delhi",
      "state": "Delhi",
      "pincode": "110001",
      "organizations": [
        {
          "_id": "507f1f77bcf86cd799439012",
          "name": "FireEx Services"
        },
        {
          "_id": "507f1f77bcf86cd799439013",
          "name": "Emergency Response Unit"
        }
      ],
      "isActive": true
    }
  }
}
```

**Error Responses:**
- `400`: INVALID_OTP - OTP doesn't match
- `400`: OTP_EXPIRED - OTP expired (5 min validity)
- `404`: PHONE_NOT_REGISTERED - Mobile number not found
- `403`: USER_INACTIVE - User account is inactive

---

#### 3. Refresh Access Token
```
POST /api/auth/refresh
```

**Authentication:** ❌ Not required

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

**Error Responses:**
- `401`: INVALID_REFRESH_TOKEN - Token is invalid
- `401`: REFRESH_TOKEN_EXPIRED - Refresh token expired (30 days)
- `401`: REFRESH_TOKEN_REVOKED - Token was revoked
- `403`: USER_INACTIVE - User account is inactive

---

#### 4. Logout
```
POST /api/auth/logout
```

**Authentication:** ✅ Required (JWT Bearer token)

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### User Endpoints

#### 1. User Login
```
POST /api/users/login
```

**Authentication:** ❌ Not required

**Request Body:**
```json
{
  "mobileNumber": "8888888888"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": {
      // Same as OTP verify response
    }
  }
}
```

---

#### 2. Get Current User
```
GET /api/users/me
```

**Authentication:** ✅ Required (JWT Bearer token)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "mobileNumber": "8888888888",
    "appRole": "user",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "address": "123 Main Street",
    "city": "New Delhi",
    "state": "Delhi",
    "pincode": "110001",
    "organizations": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "name": "FireEx Services"
      }
    ],
    "isActive": true
  }
}
```

---

### Device Endpoints

#### 1. Get All Devices
```
GET /api/devices?orgId=<organization_id>
```

**Authentication:** ✅ Required (JWT Bearer token)

**Query Parameters:**
- `orgId` (optional): Organization ID. Defaults to first organization from JWT

**Response (200):**
```json
{
  "success": true,
  "data": {
    "organization": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "FireEx Services",
      "email": "contact@firex.com",
      "mobileNumber": "1111111111",
      "address": "789 Fire Station Road",
      "city": "New Delhi",
      "state": "Delhi",
      "pincode": "110002",
      "gstNumber": "27AABCT1234H1Z0",
      "registrationNumber": "REG123456",
      "isActive": true
    },
    "deviceList": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "deviceName": "Main Entrance Detector",
        "deviceType": "smoke_detector",
        "floor": {
          "floorsNo": 1,
          "name": "Ground Floor"
        },
        "room": {
          "roomNumber": "101",
          "name": "Lobby"
        },
        "status": "active",
        "location": "Near entrance door",
        "serialNumber": "SD-2024-001",
        "installationDate": "2024-01-15T00:00:00.000Z",
        "isActive": true,
        "createdAt": "2024-10-08T10:30:00.000Z",
        "updatedAt": "2024-10-08T10:30:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- `400`: ORG_ID_MISSING - No organization provided
- `401`: UNAUTHORIZED - Missing or invalid JWT token
- `403`: FORBIDDEN - User doesn't have access to this organization
- `404`: ORGANIZATION_NOT_FOUND - Organization not found

---

#### 2. Get Devices by Floor
```
GET /api/devices/floor/:floorNumber?orgId=<organization_id>
```

**Authentication:** ✅ Required (JWT Bearer token)

**Path Parameters:**
- `floorNumber` (required): Floor number (integer)

**Query Parameters:**
- `orgId` (optional): Organization ID

**Response (200):** Same as Get All Devices

**Error Responses:**
- `400`: INVALID_FLOOR_NUMBER - Floor number is not a valid integer

---

#### 3. Get Devices by Room
```
GET /api/devices/room/:roomNumber?orgId=<organization_id>
```

**Authentication:** ✅ Required (JWT Bearer token)

**Path Parameters:**
- `roomNumber` (required): Room number (string, e.g., "101", "A-02")

**Query Parameters:**
- `orgId` (optional): Organization ID

**Response (200):** Same as Get All Devices

---

#### 4. Get Device Details
```
GET /api/devices/:id
```

**Authentication:** ✅ Required (JWT Bearer token)

**Path Parameters:**
- `id` (required): Device ID (MongoDB ObjectId)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "deviceName": "Main Entrance Detector",
    "deviceType": "smoke_detector",
    "floor": {
      "floorsNo": 1,
      "name": "Ground Floor"
    },
    "room": {
      "roomNumber": "101",
      "name": "Lobby"
    },
    "status": "active",
    "location": "Near entrance door",
    "serialNumber": "SD-2024-001",
    "installationDate": "2024-01-15T00:00:00.000Z",
    "isActive": true,
    "createdAt": "2024-10-08T10:30:00.000Z",
    "updatedAt": "2024-10-08T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: INVALID_DEVICE_ID - Device ID is not a valid ObjectId
- `403`: FORBIDDEN - Device doesn't belong to user's organizations
- `404`: DEVICE_NOT_FOUND - Device not found

---

## Enumerations

### Device Types
- `smoke_detector` - Smoke detection device
- `heat_detector` - Heat detection device
- `sprinkler` - Automatic fire suppression system
- `alarm` - Fire alarm system
- `camera` - Surveillance camera
- `extinguisher` - Fire extinguisher
- `other` - Other devices

### Device Status
- `active` - Device is operational
- `inactive` - Device is not operational
- `maintenance` - Device under maintenance

### User Roles
- `user` - Regular user
- `serviceBody` - Service provider/body

---

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {} // Optional additional information
}
```

### Common Error Codes
- `VALIDATION_ERROR` (400) - Request body validation failed
- `UNAUTHORIZED` (401) - Missing or invalid authentication
- `FORBIDDEN` (403) - User doesn't have access
- `NOT_FOUND` (404) - Resource not found
- `INTERNAL_SERVER_ERROR` (500) - Server error

---

## Token Expiry & Refresh Flow

1. **Access Token:** Valid for 15 minutes
2. **Refresh Token:** Valid for 30 days
3. **Refresh Flow:**
   - When access token expires (401)
   - Call `POST /api/auth/refresh` with refresh token
   - Get new access and refresh tokens
   - Update stored tokens

---

## Rate Limiting

Currently no rate limiting. Will be added in production.

---

## Testing with Swagger UI

1. Navigate to `http://localhost:4000/api/docs`
2. Click "Authorize" button
3. Paste JWT access token
4. All protected endpoints will automatically include the token

---

## Multi-Organization Access

Users can belong to multiple organizations:

```javascript
// From JWT payload
const organizations = decoded.organizations;  // Array of { _id, name }

// Get first org (default)
const primaryOrgId = organizations[0]._id;

// Access specific org devices
const response = await fetch(`/api/devices?orgId=${orgId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## Implementation Status

✅ Authentication (OTP + JWT)
✅ User Management
✅ Device CRUD operations
✅ Multi-organization support
✅ Swagger documentation
✅ Error handling
✅ JWT token refresh
✅ Database migrations

---

## Contact

For issues or questions about the API, contact: support@fireex.com
