<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Wellness The Hannam - Integrated Operation System
Total Management Solution for Wellness The Hannam Members, Memberships, Care Records, and System Administration.

---

## 🚀 Release Notes: System Hardening & Data Hub

### 📋 Summary
This update focuses on strengthening system security, removing legacy dependencies, and enhancing data management capabilities. Key improvements include a mandatory secondary authentication for sensitive actions, removal of the deprecated EmailJS service, and a new Data Hub for system backups and migration.

### ✨ Key Features & Changes

#### 1. 🔐 Security Enhancement
- **Mandatory 2FA for Password Changes**: Implemented strict verification logic requiring a specific security code (`01058060134`) to authorize password updates.
- **Affected Areas**:
    - Admin Master Settings (Security Policy)
    - Member Portal (Password Reset)

#### 2. 💾 Data Hub Implementation
- **Cloud Backup System**: New `MasterSettings` tab allowing admins to:
    - Create full system snapshots (Members, Memberships, Care Records, etc.).
    - Save backups securely to Supabase and download as JSON.
- **Migration Support**: Added a downloadable Excel template (`.xlsx`) for bulk member uploads.

#### 3. 🛠️ Codebase Cleanup
- **EmailJS Removal**: Completely stripped out `@emailjs/browser` dependency and related code.
- **Refactoring**: Reorganized Admin directory structure for better scalability.

---

## 📂 Project Structure

The project follows a feature-based page organization with a flat component structure.

```mermaid
graph TD
    Root[Root] --> Pages
    Root --> Components
    Root --> Lib[Core Logic]
    
    Lib --> DB[db.ts (Supabase Client)]
    Lib --> Types[types.ts (Interfaces)]
    
    Pages --> Admin[pages/admin]
    Pages --> Member[pages/member]
    Pages --> Auth[pages/auth]
    
    Admin --> Dashboard[dashboard/]
    Admin --> Membership[membership/]
    Admin --> Care[care/]
    Admin --> System[system/]
    
    Member --> Portal[MemberPortal.tsx]
    
    Auth --> Login[LoginPage.tsx]
    Auth --> OTP[OTPPage.tsx]

    Components --> Layout[AdminLayout.tsx]
    Components --> Common[common/]
```

### Directory Layout (`pages/admin/`)

| Directory | Contents | Description |
|-----------|----------|-------------|
| **`dashboard/`** | `AdminDashboard.tsx` | Main admin overview and scheduling view. |
| **`membership/`** | `MemberManagement.tsx`<br>`ContractManagement.tsx` | Member registration, list view, and contract handling. |
| **`care/`** | `CareRecordManagement.tsx`<br>`CareSessionPage.tsx` | Care history tracking and active session management. |
| **`system/`** | `NoticeManagement.tsx`<br>`MasterSettings.tsx` | System-wide notices, product configurations, and data backup. |

---

## 💻 Getting Started

### Prerequisites
- Node.js installed

### Installation & Run

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   Ensure `.env.local` is configured with necessary API keys (Supabase, etc.).

3. **Run the app:**
   ```bash
   npm run dev
   ```
