# Digi2FM — Digital-to-FM Software Modem

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-Expo-blue?style=for-the-badge&logo=expo" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20iOS-green?style=for-the-badge" />
  <img src="https://img.shields.io/github/v/release/xjanova/digi2FM?style=for-the-badge" />
</p>

<p align="center">
  <strong>Send any file between phones using sound waves — just like a 90s dial-up modem.</strong>
</p>

<p align="center">
  <a href="https://xjanova.github.io/digi2FM/"><strong>🌐 Visit the project website →</strong></a>
</p>

---

## What is Digi2FM?

Digi2FM converts digital files into **analog audio signals** using **FSK (Frequency Shift Keying)** — the same modulation technique used by dial-up modems. One phone plays the encoded audio through its speaker; another phone captures it through its microphone and decodes it back into the original file.

**No internet. No Bluetooth. No WiFi. Just sound.**

## Quick specs

| | |
|---|---|
| **Modulation** | FSK · Bell 202 (1200 Hz mark / 2200 Hz space) |
| **Baud rate** | 300 / 600 / 1200 |
| **Demodulation** | Goertzel algorithm @ 44.1 kHz |
| **Error correction** | CRC-16-CCITT · Hamming(7,4) · Repetition(3×) |
| **Encryption** | TweetNaCl (optional) |
| **Platform** | Android · iOS (Expo / React Native) |

## Install

```bash
git clone https://github.com/xjanova/digi2FM.git
cd digi2FM
npm install
npx expo run:android       # or: npx expo run:ios
```

> Requires a development build — does not work with Expo Go.

Pre-built APKs are available on the [Releases](https://github.com/xjanova/digi2FM/releases) page.

## Learn more

Full documentation, architecture diagrams, performance benchmarks, and a live waveform demo are available on the project website:

### **→ [xjanova.github.io/digi2FM](https://xjanova.github.io/digi2FM/)**

## License

MIT
