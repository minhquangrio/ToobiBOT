const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    {
        name: 'warn',
        description: 'Cảnh báo một thành viên.',
        options: [
            {
                name: 'user',
                type: 6, // USER type
                description: 'Thành viên cần cảnh báo',
                required: true,
            },
            {
                name: 'reason',
                type: 3, // STRING type
                description: 'Lý do cảnh báo',
                required: false,
            },
        ],
    },
    {
        name: 'ban',
        description: 'Cấm một thành viên khỏi server.',
        options: [
            {
                name: 'user',
                type: 6, // USER type
                description: 'Thành viên cần cấm',
                required: true,
            },
            {
                name: 'reason',
                type: 3, // STRING type
                description: 'Lý do cấm',
                required: false,
            },
        ],
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log(`Đang làm mới ${commands.length} lệnh ứng dụng (/).`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log(`Đã tải lại thành công ${data.length} lệnh ứng dụng (/).`);
    } catch (error) {
        console.error(error);
    }
})();