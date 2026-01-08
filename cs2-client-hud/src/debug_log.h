#pragma once
#include <fstream>
#include <string>
#include <windows.h>
#include <iostream>

inline void Log(const std::string& msg) {
    // 1. Try file log in a safe location
    std::ofstream outfile("c:\\Users\\sandbox\\Documents\\auto-cs2\\csdm\\cs2-hud-debug.log", std::ios_base::app);
    if (outfile.is_open()) {
        outfile << "[CS2-HUD] " << msg << std::endl;
        outfile.close();
    }
    
    // 2. Also print to Console if it exists
    static bool consoleAllocated = false;
    if (!consoleAllocated) {
        if (AllocConsole()) {
            FILE* f;
            freopen_s(&f, "CONOUT$", "w", stdout);
            freopen_s(&f, "CONOUT$", "w", stderr);
            consoleAllocated = true;
        }
    }
    std::cout << "[CS2-HUD] " << msg << std::endl;
}
