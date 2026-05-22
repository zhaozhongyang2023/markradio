# MoodWave Switch Launcher Makefile
# 需要 devkitPro 环境: https://devkitpro.org/wiki/Getting_Started
# 编译: make
# 产物: moodwave.nro

TARGET       := moodwave
BUILD        := build
SOURCES      := .
INCLUDES     := .
DATA         :=
ROMFS        :=
ICON         :=
NACP         :=

# 默认 Switch 服务器地址 (可在 make 时覆盖)
# make SERVER_IP=192.168.x.x
SERVER_IP   ?= 192.168.2.33
SERVER_PORT ?= 8765
DEFINES     := -DSERVER_IP="\"$(SERVER_IP)\"" -DSERVER_PORT=$(SERVER_PORT)

ARCH         := -march=armv8-a+crc+crypto -mtune=cortex-a57 -mtp=soft
CFLAGS       := -g -Wall -O2 -ffunction-sections $(ARCH) $(DEFINES)
CXXFLAGS     := $(CFLAGS) -fno-rtti -fno-exceptions -std=gnu++17
ASFLAGS      := -g $(ARCH)
LDFLAGS      := -specs=$(DEVKITPRO)/libnx/switch.specs -g $(ARCH) -Wl,-Map,$(notdir $*.map)
LIBS         := -lnx

include $(DEVKITPRO)/libnx/switch_rules
