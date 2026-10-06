plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.irontrack"
    compileSdk = 34
    defaultConfig { applicationId = "com.irontrack"; minSdk = 26; targetSdk = 34; versionCode = 5; versionName = "3.0" }
    signingConfigs {
        getByName("debug") { storeFile = file("irontrack.jks"); storePassword = "irontrack"; keyAlias = "irontrack"; keyPassword = "irontrack" }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.documentfile:documentfile:1.0.1")
}
