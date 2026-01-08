#include <windows.h>
#include "hooks.h"
#include <thread>
#include "debug_log.h"

void MainThread() {
    Log("MainThread started. Attempting to install hooks...");
    if (InstallHooks()) {
        Log("Hooks installed successfully.");
    } else {
        Log("Failed to install hooks.");
    }
}

BOOL WINAPI DllMain(HINSTANCE hinstDLL, DWORD fdwReason, LPVOID lpvReserved) {
    if (fdwReason == DLL_PROCESS_ATTACH) {
        DisableThreadLibraryCalls(hinstDLL);
        Log("DLL_PROCESS_ATTACH");
        CreateThread(nullptr, 0, (LPTHREAD_START_ROUTINE)MainThread, nullptr, 0, nullptr);
    } else if (fdwReason == DLL_PROCESS_DETACH) {
        Log("DLL_PROCESS_DETACH");
        if (lpvReserved != nullptr) {
            Log("Process terminating. Skipping shutdown.");
        } else {
            RemoveHooks();
        }
    }
    return TRUE;
}
