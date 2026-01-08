cmake_minimum_required(VERSION 3.15)
project(cs2-client-hud)

set(CMAKE_CXX_STANDARD 17)

# --- Dependencies ---

# 1. MinHook (FetchContent)
include(FetchContent)
FetchContent_Declare(
  minhook
  GIT_REPOSITORY https://github.com/TsudaKageyu/minhook.git
  GIT_TAG        master
)
FetchContent_MakeAvailable(minhook)

# 2. Ultralight (Assumed local in deps/ultralight)
set(ULTRALIGHT_SDK_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/deps/ultralight")

# Check if Ultralight exists
if(NOT EXISTS "${ULTRALIGHT_SDK_ROOT}/include/Ultralight/Ultralight.h")
    message(WARNING "Ultralight SDK not found in deps/ultralight. Please download it from https://ultralig.ht/ and place it there.")
endif()

include_directories(${ULTRALIGHT_SDK_ROOT}/include)

# Find Libraries explicitly to avoid link_directories issues
find_library(ULTRALIGHT_LIB Ultralight PATHS ${ULTRALIGHT_SDK_ROOT}/lib NO_DEFAULT_PATH)
find_library(ULTRALIGHTCORE_LIB UltralightCore PATHS ${ULTRALIGHT_SDK_ROOT}/lib NO_DEFAULT_PATH)
find_library(WEBCORE_LIB WebCore PATHS ${ULTRALIGHT_SDK_ROOT}/lib NO_DEFAULT_PATH)
find_library(APPCORE_LIB AppCore PATHS ${ULTRALIGHT_SDK_ROOT}/lib NO_DEFAULT_PATH)

# --- Target ---

add_library(cs2-hud SHARED
    src/main.cpp
    src/hooks.cpp
    src/renderer.cpp
    src/state_saver.cpp
)

target_link_libraries(cs2-hud
    PRIVATE
    minhook
    d3dcompiler
    d3d11
    dxgi
    ${APPCORE_LIB}     # AppCore depends on others, order usually matters in static, but for import libs it's fine.
    ${ULTRALIGHT_LIB}
    ${ULTRALIGHTCORE_LIB}
    ${WEBCORE_LIB}
)

# Copy Ultralight DLLs to output directory (Windows only)
if(WIN32)
    add_custom_command(TARGET cs2-hud POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${ULTRALIGHT_SDK_ROOT}/bin"
        "$<TARGET_FILE_DIR:cs2-hud>"
    )
endif()
