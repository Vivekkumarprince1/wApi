# Career Portal Dev Credentials

These credentials are for local development and QA only. Do not expose them in the public UI or reuse them in production.

Base URL:

```txt
http://localhost:3200
```

Shared password for all seeded accounts:

```txt
Password@123
```

OTP for demo email verification and password reset:

```txt
123456
```

## Role Accounts

| Role | Name | Email | Password | Default Route | Access |
|---|---|---|---|---|---|
| Candidate/User | Asha Sharma | `asha.sharma@example.com` | `Password@123` | `/my-applications` | Candidate applications, notifications, job apply |
| Employee | Tara Singh | `employee@connectsphere.example` | `Password@123` | `/employee/profile` | Employee profile, review submission, referral recommendations |
| HR Employee | Mira Bedi | `hr@connectsphere.example` | `Password@123` | `/admin/dashboard` | HR dashboard, applicants, jobs, offers, certificates, reviews, recommendations |
| Admin | Aparna Mehta | `admin@connectsphere.example` | `Password@123` | `/admin/dashboard` | All admin permissions except super-admin-only audit routing semantics |
| Super Admin | Ishaan Kapoor | `super@connectsphere.example` | `Password@123` | `/admin/audit-logs` | Full access, including audit logs and manage HR |
| Unverified Candidate | Unverified Candidate | `unverified@connectsphere.example` | `Password@123` | `/verify-email` | OTP verification flow only until verified |

## Permission Notes

Candidate/User:

```txt
No admin permissions.
```

Employee:

```txt
No admin permissions. Employee-only routes allow review and referral submission.
```

HR Employee:

```txt
canAccessDashboard
canCreateJob
canViewApplicants
canGenerateCertificate
canGenerateOfferLetter
canManageReviews
canManageRecommendations
```

Admin and Super Admin:

```txt
canAccessDashboard
canCreateJob
canViewApplicants
canGenerateCertificate
canGenerateOfferLetter
canManageReviews
canManageEmployees
canManageRecommendations
```

## Quick Checks

Login API:

```bash
curl -s -c /tmp/career.jar \
  -H 'content-type: application/json' \
  --data '{"email":"hr@connectsphere.example","password":"Password@123"}' \
  http://localhost:3200/api/v1/auth/login
```

Current session:

```bash
curl -s -b /tmp/career.jar http://localhost:3200/api/v1/auth/me
```

Logout:

```bash
curl -s -b /tmp/career.jar -X POST http://localhost:3200/api/v1/auth/logout
```
