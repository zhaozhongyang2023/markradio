// MoodWave Switch Launcher — 极简 NRO 启动器
// 编译: make (需要 devkitPro + libnx)
// 用法: 通过 Homebrew Menu 启动，自动唤起 Switch 浏览器打开 MoodWave /switch 页面

#include <switch.h>
#include <string.h>
#include <stdio.h>

// ── 服务器地址（编译时通过 make SERVER_IP=... SERVER_PORT=... 设置）──
#ifndef SERVER_IP
#define SERVER_IP "192.168.2.33"
#endif
#ifndef SERVER_PORT
#define SERVER_PORT "8765"
#endif


int main(int argc, char **argv)
{
    char url[256];
    snprintf(url, sizeof(url), "http://%s:%s/switch", SERVER_IP, SERVER_PORT);
    consoleInit(NULL);

    // 初始化网络
    socketInitializeDefault();
    nxlinkStdio();

    printf("MoodWave Switch Companion\n");
    printf("正在连接到 %s ...\n", url);

    // 唤起 WebApplet 浏览器
    Result rc = 0;
    WebCommonConfig config;
    webPageCreate(&config, url);
    webConfigSetWhitelist(&config, ".*");
    webConfigSetBootFooterButtonVisible(&config, WebFooterButtonId_Url, true);

    // 显示浏览器
    WebWifiPageArg arg;
    memset(&arg, 0, sizeof(arg));
    arg.unk = 0x1000; // 标准模式
    rc = webConfigShow(&config, &arg);
    if (R_FAILED(rc)) {
        printf("启动浏览器失败: 0x%x\n", rc);
        printf("请确保已安装 nx-bred 或类似浏览器 homebrew\n");
        printf("或手动在浏览器中输入: %s\n", url);
        printf("\n按任意键退出...\n");
    } else {
        printf("浏览器已启动!\n");
    }

    // 等待用户按键退出
    consoleUpdate(NULL);
    while (appletMainLoop()) {
        hidScanInput();
        u64 kDown = hidKeysDown(CONTROLLER_P1_AUTO);
        if (kDown & KEY_PLUS) break;
        consoleUpdate(NULL);
    }

    webConfigCleanup();
    socketExit();
    consoleExit(NULL);
    return 0;
}
