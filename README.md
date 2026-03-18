# Digi2FM - Digital-to-FM Software Modem

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-Expo-blue?style=for-the-badge&logo=expo" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20iOS-green?style=for-the-badge" />
  <img src="https://img.shields.io/github/v/release/xjanova/digi2FM?style=for-the-badge" />
</p>

<p align="center">
  <strong>Send any file between phones using sound waves - just like a 90s dial-up modem!</strong>
</p>

---

## What is Digi2FM?

Digi2FM converts digital files (images, documents, audio, anything) into **analog audio signals** using **FSK (Frequency Shift Keying)** modulation - the same technology used by dial-up modems in the 1990s.

One phone plays the encoded audio through its **speaker**, and another phone captures it through its **microphone**, then decodes it back into the original file.

**No internet. No Bluetooth. No WiFi. Just sound.**

## How It Works

```
Sender                                Receiver
+--------+    +--------+    +-----+    +--------+    +--------+
|  File   | -> | Encode | -> | FSK | -> |  Mic   | -> | Decode |
| (any)   |    | Binary |    | Mod |    | Record |    | Binary |
+--------+    +--------+    +-----+    +--------+    +--------+
                               |                          |
                          Speaker out              Original file
                         1200/2200 Hz              reconstructed
```

### Technical Details

| Parameter | Value |
|-----------|-------|
| Modulation | FSK (Bell 202 Standard) |
| Mark (bit 1) | 1200 Hz |
| Space (bit 0) | 2200 Hz |
| Baud Rate | 300 / 600 / 1200 (configurable) |
| Sample Rate | 44100 Hz |
| Demodulation | Goertzel Algorithm |
| Error Detection | CRC-16-CCITT |
| Error Correction | None / Repetition (3x) / Hamming(7,4) |
| Packet Size | 64 bytes max payload |
| Protocol | Custom with preamble + sync word |

## Download APK

Go to the [**Releases**](https://github.com/xjanova/digi2FM/releases) page to download the latest APK for Android.

> You can also trigger a build manually from the **Actions** tab.

## Features

- **Send Mode** - Pick any file, transmit as FSK audio through speaker
- **Receive Mode** - Listen via microphone, decode and save the file
- **Real-time Visualizer** - Animated waveform during transmission/reception
- **Configurable** - Baud rate, error correction mode, debug mode
- **Large File Support** - Files are chunked into packets with sequence numbering
- **Progress Tracking** - Packet-level progress with estimated time remaining
- **Cross-Platform** - Works on both Android and iOS

## Screenshots

| Send | Receive | Settings |
|------|---------|----------|
| Select file & transmit | Listen & receive | Configure modem parameters |

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- Android Studio (for Android builds) or Xcode (for iOS)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/xjanova/digi2FM.git
cd digi2FM

# Install dependencies
npm install

# Run on Android (requires dev build, not Expo Go)
npx expo run:android

# Run on iOS
npx expo run:ios
```

> **Note:** This app uses `react-native-audio-api` which requires a development build. It will not work with Expo Go.

### Build APK Locally

```bash
# Generate Android project
npx expo prebuild --platform android

# Build release APK
cd android && ./gradlew assembleRelease
```

The APK will be at `android/app/build/outputs/apk/release/`.

## Transfer Speed

| Baud Rate | Error Correction | Effective Speed | 1 KB | 100 KB |
|-----------|-----------------|-----------------|------|--------|
| 300 | None | ~25 B/s | ~40s | ~1h 7m |
| 300 | Repetition (3x) | ~8 B/s | ~2m | ~3h 20m |
| 1200 | None | ~100 B/s | ~10s | ~17m |
| 1200 | Repetition (3x) | ~33 B/s | ~30s | ~50m |

## Project Structure

```
src/
  audio/          # FSK modulation/demodulation, Goertzel algorithm
  protocol/       # Packet framing, CRC, sync detection, file chunking
  codec/          # Binary encoding, error correction (Hamming, repetition)
  screens/        # Send, Receive, Settings screens
  components/     # Reusable UI components
  hooks/          # React hooks for transmitter/receiver logic
  context/        # Settings context (shared state)
  constants/      # Protocol configuration
  utils/          # File I/O, permissions
  types/          # TypeScript type definitions
```

## License

MIT

---

<p align="center">
  <sub>Built with sound waves and nostalgia</sub>
</p>
