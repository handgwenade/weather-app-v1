# Apple App Privacy Cheat Sheet

## App

- **App name:** RoadSignal
- **Bundle ID:** com.gwendolynh.roadsignal
- **Privacy Policy URL:** <https://www.roadsignal.app/privacy>

## Current Assumptions

Use these answers unless the app changes later.

- No user accounts
- No ads
- No tracking
- No analytics SDK
- No crash-reporting SDK
- No diagnostics collection
- Saved locations are stored locally
- Device location may be used if permission is granted
- Location-based requests may be sent to third-party providers to retrieve app data

## Data Types To Review

### Location

- **Precise Location:** Yes
- **Reason:** App functionality
- **Why:** The app may use device location to show relevant nearby weather, alerts, and road-related information

### Contact Info

- **Collects contact info:** No

### Identifiers

- **Collects user identifiers:** No

### Diagnostics

- **Collects diagnostics:** No

### Usage Data

- **Collects usage data:** No

## Apple Privacy Form Working Answers

### Does the app collect data?

- **Yes**, because location may be sent off-device to retrieve app functionality

### Is data linked to the user?

- **No**

### Is data used for tracking?

- **No**

## Likely Apple Disclosure Selections

### Data Type: Precise Location

- **Collected:** Yes
- **Linked to User:** No
- **Used for Tracking:** No
- **Purpose:** App Functionality

### All Other Common Types

- Contact Info: No
- Health & Fitness: No
- Financial Info: No
- Sensitive Info: No
- Contacts: No
- User Content: No
- Browsing History: No
- Search History: No
- Purchases: No
- Diagnostics: No
- Usage Data: No
- Identifiers: No

## SDKs / Services To Check

Before filling the form, confirm none of these were added:

- Analytics SDKs
  - Firebase Analytics
  - Mixpanel
  - Amplitude
  - PostHog

- Crash / diagnostics SDKs
  - Sentry
  - Crashlytics
  - App Center

- Ad / tracking SDKs
  - Google Mobile Ads
  - Meta SDK
  - Adjust
  - AppsFlyer

## Third-Party Service Notes

The app may communicate with third-party providers for app functionality, such as:

- weather data providers
- map providers
- alert providers
- road-data providers
- hosting providers

These are functional service calls, not ad tracking.

## Notes / Follow-Up

- If analytics or crash reporting are added later, update this file
- If user accounts are added later, update linked-to-user answers
- If support forms or email collection are added in-app, update contact-info answers
- If web/backend behavior changes data handling, re-check disclosures
