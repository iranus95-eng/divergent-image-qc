plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.example.locationfinderforinsx"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.locationfinderforinsx"
        minSdk = 26
        targetSdk = 35
        versionCode = 62300
        versionName = "6.21.0"
        buildConfigField("String", "SUPABASE_URL", "\"https://neauzvqroaszvqffahkv.supabase.co\"")
        buildConfigField("String", "SUPABASE_KEY", "\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYXV6dnFyb2FzenZxZmZhaGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNDk2OTQsImV4cCI6MjEwMzgyNTY5NH0.TpxNtbgWANFboqKAe8f3akinawuwbvFlohz2OwVV7iw\"")
    }

    // One permanent release key (kept in GitHub secrets, never in the repo) so every new
    // version installs over the previous one. Without it the build falls back to a debug key.
    val releaseKeystore = System.getenv("ANDROID_KEYSTORE_FILE")?.takeIf { it.isNotBlank() }?.let { file(it) }?.takeIf { it.exists() }
    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                storeFile = releaseKeystore
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: "divergent"
                keyPassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (releaseKeystore != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions { jvmTarget = "11" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
