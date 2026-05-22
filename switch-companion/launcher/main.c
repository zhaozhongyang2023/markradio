// MoodWave Switch Launcher — 极简 NRO 启动器
// 编译: make (需要 devkitPro + libnx)
// 用法: 通过 Homebrew Menu 启动，自动唤起 Switch 浏览器打开 MoodWave /switch 页面

#include <switch.h>
#include <string.h>

// ═══ 在此修改默认服务器地址 ═══
// 替换为你的 MoodWave 服务器局域网 IP 和端口
#define MOODWAVE_URL "http://192.168.1.100:8765/switch"

int main(int argc, char **argv)
{
    consoleInit(NULL);

    // 初始化网络
    socketInitializeDefault();
    nxlinkStdio();

    printf("MoodWave Switch Companion\n");
    printf("正在连接到 %s ...\n", MOODWAVE_URL);

    // 唤起 WebApplet 浏览器
    Result rc = 0;
    WebCommonConfig config;
    webPageCreate(&config, MOODWAVE_URL);
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
        printf("或手动在浏览器中输入: %s\n", MOODWAVE_URL);
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
