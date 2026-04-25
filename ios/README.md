# CapitalQuest iOS Setup

These steps run the iOS app from Xcode on a new Mac.

## Prerequisites

Install Xcode from the Mac App Store, then install the command line tools:

```bash
xcode-select --install
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

Install Node, Watchman, and CocoaPods:

```bash
brew install node watchman
gem install cocoapods
```

If you use `rbenv`, install CocoaPods through your rbenv Ruby instead of using `sudo`.

## First-Time Setup

Clone the repository and install JavaScript dependencies:

```bash
git clone https://github.com/Aussie-slenderman/Capitalquest.co.git
cd Capitalquest.co
npm install
```

Install iOS Pods:

```bash
cd ios
pod install
cd ..
```

Open the workspace, not the Xcode project:

```bash
open ios/CapitalQuest.xcworkspace
```

In Xcode, select the `CapitalQuest` scheme and an iOS simulator, then run **Product > Clean Build Folder** before the first build.

## Running Locally

Start Metro from the project root and keep the terminal open:

```bash
npx expo start
```

Then run the app from Xcode.

For Debug builds, the app loads JavaScript from Metro. If Metro is not running, the simulator can show `No bundle URL present`.

## Common Fixes

If Xcode keeps using stale build output:

1. Quit Xcode.
2. Delete `~/Library/Developer/Xcode/DerivedData/CapitalQuest-*`.
3. Reopen `ios/CapitalQuest.xcworkspace`.
4. Run **Product > Clean Build Folder**.
5. Build again.

If native module errors appear after changing packages:

```bash
cd ios
pod install
cd ..
npx expo start --clear
```

Then rebuild from Xcode. If the simulator still shows the old app state, delete `CapitalQuest` from the simulator and run again.
