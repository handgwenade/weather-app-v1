# Google Play Data Safety Cheat Sheet

## App

- **App name:** RoadSignal
- **Package name:** com.gwendolynh.roadsignal
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

## Likely Google Play Answers

### Does the app collect or share any user data?

- **Likely answer:** Yes

### Why?

- The app may send location-based request data to third-party service providers to retrieve weather, alerts, map, or road-related information for app functionality.

## Data Types To Review

### Location

- **Precise location:** Yes
- **Purpose:** App functionality

### Personal info

- **Name:** No
- **Email address:** No
- **User IDs:** No
- **Address:** No
- **Phone number:** No

### Financial info

- **Collects financial info:** No

### Messages

- **Collects messages:** No

### Photos and videos

- **Collects photos/videos:** No

### Audio files

- **Collects audio:** No

### Files and docs

- **Collects files/docs:** No

### Calendar

- **Collects calendar data:** No

### Contacts

- **Collects contacts:** No

### App activity

- **App interactions:** No
- **In-app search history:** No
- **Installed apps:** No
- **Other user-generated content:** No

### Web browsing

- **Web browsing history:** No

### Diagnostics

- **Crash logs:** No
- **Diagnostics:** No
- **Other app performance data:** No

### Device or other IDs

- **Collects device or other IDs:** No

## Data Handling

- **Data encrypted in transit:** Yes
- **User can request data deletion:** No / Not applicable unless server-side user data is added later

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

- Ad / attribution SDKs
  - Google Mobile Ads
  - Meta SDK
  - AppsFlyer
  - Adjust

## Third-Party Service Notes

The app may communicate with third-party service providers for app functionality, such as:

- weather data providers
- map providers
- alert providers
- road-data providers
- hosting providers

These are functional service calls, not ad tracking.

## Notes / Follow-Up

- If analytics or crash reporting are added later, update this file
- If user accounts are added later, update this file
- If support forms or email collection are added in-app, update this file
- If backend/server-side user storage is added later, revisit deletion answers
