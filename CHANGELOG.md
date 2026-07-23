# Changelog

All notable changes to the PGConf Scanner app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-23

### Added
- Deep linking so that tapping a conference check-in, field check-in, or
  sponsor-scanning link opens the app directly when it is installed, falling
  back to the browser-based web app otherwise. Supported on Android (App
  Links) and iOS (Universal Links) for events hosted on `www.postgresql.eu`,
  `postgresql.us`, `www.pgevents.ca` and `pgday.uk`.

### Removed
- The unused `pgeuconf` and `conferencescanner` custom URL schemes, which were
  never emitted by the backend.

## [1.0.1]

- Initial App Store release.
