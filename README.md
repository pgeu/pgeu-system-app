# PGEU PGConf Scanner

[![CI](https://github.com/pgeu/pgeu-system-app/workflows/Continuous%20Integration/badge.svg)](https://github.com/pgeu/pgeu-system-app/actions/workflows/ci.yml)

A cross-platform mobile application for conference attendee check-in and badge scanning, built with Ionic Framework and Capacitor for iOS and Android.

## Overview

The PGEU PGConf Scanner is a professional conference management tool used by PostgreSQL Europe and related organizations to:

- **Check in attendees** at conference registration using QR code scanning
- **Scan sponsor badges** to capture attendee interactions at sponsor booths
- **Manage field check-ins** for special events (t-shirt distribution, training sessions, etc.)
- **View real-time statistics** on check-in progress (admin users)

This Ionic application replaces the legacy Android-only app, expanding support to iOS while modernizing the codebase with current best practices and web technologies.

## Platform Support

- **iOS:** 16.0 and later
- **Android:** 8.0 (API 26) and later, targeting API 35

**Architecture Principles:**

- Modern, non-deprecated APIs only
- TypeScript strict mode for type safety
- Network-first design (no offline mode)

## Key Features

### Three Scanning Modes

1. **Check-in Processing**
   - Scan attendee tickets (ID$ tokens)
   - View attendee details with field highlighting
   - Confirm registration and mark attendance

2. **Sponsor Badge Scanning**
   - Scan attendee badges at sponsor booths (AT$ tokens)
   - Add and edit notes for each scan
   - Track sponsor-attendee interactions

3. **Field Check-in**
   - Specialized check-ins for logistics (t-shirts, meals, training)
   - Field-specific workflows (AT$ tokens with field ID)

### Multi-Conference Support

- Manage multiple conferences simultaneously
- Add conferences via deep link or manual URL
- Switch between conferences seamlessly
- Persistent conference selection

### Additional Features

- Attendee search by name (check-in mode)
- Real-time statistics dashboard (admin only)
- Deep linking for easy setup

## Technology Stack

**Core Framework:**

- Ionic Framework 8.8
- Capacitor 7.6
- React 18.2
- TypeScript 5.9 (strict mode)
- Vite 7 (build tool)

**Key Dependencies:**

- **UI Components:** @ionic/react (Ionic UI components)
- **QR Scanning:** @capacitor-mlkit/barcode-scanning
- **Networking:** Capacitor's native HTTP client (`CapacitorHttp`), retrying on network and 5xx errors
- **Storage:** @capacitor/preferences
- **Deep Links:** @capacitor/app
- **State Management:** Zustand (global state)
- **Routing:** React Router 7 (`react-router-dom`)
- **Icons:** Ionicons
- **Asset Generation:** @capacitor/assets, run on demand with `npx @capacitor/assets generate` (not a project dependency)

## Project Structure

```
pgeu-system-app/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Ionic page components
│   ├── services/         # Business logic services
│   ├── store/            # State management (Zustand)
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Helper functions
│   ├── hooks/            # Custom React hooks
│   ├── constants/        # App-wide constants
│   ├── content/          # Static content
│   └── test/             # Test utilities and setup
├── public/               # Static assets
├── ios/                  # iOS native code (Capacitor)
├── android/              # Android native code (Capacitor)
└── .claude/              # Technical documentation
```

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Xcode** 16+ (for iOS development, macOS only)
- **Android Studio** 2024.2.1+ (for Android development)
- **Java 21** (for Android builds)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/pgeu/pgeu-system-app.git
   cd pgeu-system-app
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```
   The flag is needed because `@ionic/react-router` declares a peer dependency on React Router 5, whilst the app uses React Router 7. CI installs the same way.

3. **Sync native platforms**
   ```bash
   npx cap sync
   ```

4. **Run the app**

   **iOS:**
   ```bash
   npm run ios
   ```
   Or open `ios/App/App.xcworkspace` in Xcode and run

   **Android:**
   ```bash
   npm run android
   ```
   Or open the `android/` folder in Android Studio and run

### Development

**Type checking:**
```bash
npm run typecheck
```

**Linting:**
```bash
npm run lint
```

**Testing:**
```bash
npm test                # Run tests once
npm run test:watch      # Run tests in watch mode
npm run test:ui         # Run tests with UI
npm run test:coverage   # Run tests with coverage report
```

**Build:**
```bash
npm run build           # Build for production
npx cap sync           # Sync changes to native projects
```

## Testing

The PGConf Scanner has comprehensive test coverage using Vitest. Tests cover utilities, services, stores, and React components.

### Test Framework

- **Test Runner**: Vitest 4
- **React Testing**: @testing-library/react 14
- **Mocking**: Vitest built-in mocking
- **Environment**: jsdom (for DOM simulation)
- **Coverage**: v8 provider with HTML/LCOV reporting

### Test Coverage

`npm run test:coverage` fails if coverage drops below the thresholds in `vitest.config.ts`:

```typescript
thresholds: {
  lines: 65,
  functions: 60,
  branches: 60,
  statements: 65,
}
```

### Test Structure

**Utilities:**

- `conferenceParser.test.ts` - URL parsing, validation, conference creation
- `tokenValidator.test.ts` - Token format validation
- `textUtils.test.ts` - Text helpers
- `typeGuards.test.ts` - Runtime type guards

**Services:**

- `apiClient.test.ts` - HTTP requests, error handling, retry logic
- `storage.test.ts` - Conference CRUD operations
- `deepLinkService.test.ts` - Deep link parsing and handling
- `scannerService.test.ts` - Barcode scanning and permissions

**State Management:**

- `conferenceStore.test.ts` - Store operations, computed properties

**Components:**

- `ConferenceListPage.test.tsx` - Page rendering, scanner integration
- `AddConferencePage.test.tsx` - Form validation, submission
- `StatsPage.test.tsx` - Data loading, table rendering
- `HighlightedText.test.tsx` - Search term highlighting

### Common Test Patterns

**Mocking Capacitor Plugins:**

The Capacitor plugins are mocked globally in `src/test/setup.ts`, for example:

```typescript
vi.mock('@capacitor-mlkit/barcode-scanning', () => ({
  BarcodeScanner: {
    scan: vi.fn(),
    isSupported: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
  },
}));
```

The same file also configures Testing Library so that failed queries don't include a dump of the DOM; Ionic's minified components make that dump extremely slow.

**Testing Async Operations:**
```typescript
it('should load data on mount', async () => {
  mockApiClient.getData.mockResolvedValue(mockData);
  renderWithRouter(<MyPage />);

  await waitFor(() => {
    expect(mockApiClient.getData).toHaveBeenCalled();
  });
});
```

### Best Practices

1. **Test Behavior, Not Implementation** - Focus on user-visible behavior
2. **Use Descriptive Test Names** - Start with "should", be specific
3. **Arrange-Act-Assert Pattern** - Set up, perform action, verify result
4. **Mock External Dependencies** - Always mock Capacitor plugins and API clients
5. **Test Edge Cases** - Empty states, errors, invalid input, network failures

### Continuous Integration

GitHub Actions runs lint, type checking, the test suite with coverage, and a production build on every push to `main` and on every pull request against it.

Android (APK/AAB) and iOS (App Store) builds run when a `v*.*.*` tag is pushed, or manually from the Actions tab.

## Backend Integration

The app integrates with the [pgeu-system](https://github.com/pgeu/pgeu-system) Django backend for:

- Conference status and metadata
- Attendee lookup and search
- Check-in/scan operations
- Statistics (admin users)

**Authentication:** Token-based (embedded in conference URLs)
**API Format:** REST with `application/x-www-form-urlencoded` POST bodies
**Domain Support:** Any domain hosting a compatible pgeu-system backend

See [.claude/backend-scanner-api-analysis.md](.claude/backend-scanner-api-analysis.md) for complete API documentation.

## Documentation

Technical documentation is available in the `.claude/` directory:

### Backend & API
- **[backend-scanner-api-analysis.md](.claude/backend-scanner-api-analysis.md)** - Complete backend API documentation
- **[api-integration-guide.md](.claude/api-integration-guide.md)** - API integration guide

### Legacy Reference
- **[android-app-comprehensive-analysis.md](.claude/android-app-comprehensive-analysis.md)** - Original Android app analysis

### Development History
- **[.claude/archive/development/](.claude/archive/development/)** - Migration plans and implementation guides
- **[.claude/archive/react-native/](.claude/archive/react-native/)** - Archived React Native attempt

## QR Code Formats

### Check-in Ticket
```
ID$[40-64 hex character token]$ID
or
https://{domain}/t/id/{token}/

Test token: ID$TESTTESTTESTTEST$ID
```

### Sponsor/Field Badge
```
AT$[40-64 hex character token]$AT
or
https://{domain}/t/at/{token}/

Test token: AT$TESTTESTTESTTEST$AT
```

## Deep Linking

The app supports deep linking for easy conference scan setup:

**Check-in:**
```
https://{domain}/events/{event}/checkin/{token}/
```

**Field Check-in:**
```
https://{domain}/events/{event}/checkin/{token}/f{fieldId}/
```

**Sponsor Scanning:**
```
https://{domain}/events/sponsor/scanning/{token}/
```

**Setup Requirements:**

- iOS: Associated Domains + Universal Links
- Android: App Links verification + Digital Asset Links

Links open the app directly for `www.postgresql.eu`, `postgresql.us`, `www.pgevents.ca` and `pgday.uk`, as configured in `ios/App/App/App.entitlements` and `android/app/src/main/AndroidManifest.xml`. Conferences on other domains can still be added by entering the URL manually.

## App Store Deployment

### iOS App Store

- Privacy Manifest (PrivacyInfo.xcprivacy)
- Camera permission usage description
- TestFlight beta testing
- Age rating: 4+

### Google Play Store

- Data Safety declarations completed
- Target SDK 35 (Android 15)
- 64-bit native libraries
- Age rating: Everyone

## Contributing

Development follows these principles:

1. **No deprecated APIs** - Only use current, supported APIs and features
2. **TypeScript strict mode** - All code must be properly typed
3. **Test coverage** - New features must include tests
4. **Accessibility** - All UI must be screen reader compatible
5. **Platform parity** - Features must work on both iOS and Android

## Security

- **Tokens:** Stored on the device with Capacitor Preferences (UserDefaults on iOS, SharedPreferences on Android), which is not encrypted storage
- **Network:** HTTPS only; conference URLs are always rebuilt as `https://`
- **Permissions:** Camera (for scanning) and internet access only, with the camera requested at first use

## Support

For issues related to:

- **App functionality:** Check documentation in `.claude/` directory
- **Backend API:** See [pgeu-system repository](https://github.com/pgeu/pgeu-system)
- **Original Android app:** See [android-PGConfScanner repository](https://github.com/pgeu/android-PGConfScanner)

## License

This code is licenced under [The PostgreSQL License](LICENSE.md).

## Project Status

**Current Phase:** Production Ready
**Last Updated:** 2026-10-02

The Ionic + Capacitor migration is complete. The app is fully functional on both iOS 16+ and Android 8.0+ (API 26+).

---

**Built with:** Ionic Framework | Capacitor | TypeScript | React
**Platforms:** iOS 16+ | Android 8.0+ (API 26+)
**Organizations:** PostgreSQL Europe, PostgreSQL US, PGEvents Canada, PGDay UK
