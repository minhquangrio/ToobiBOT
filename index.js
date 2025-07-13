require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const spamKeywords = ['http://', 'https://', 'discord.gg/', 'free nitro', 'tặng quà', 'kiếm tiền online'];
const spamRegex = [
    /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/, // IP addresses
    /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/, // Basic domain names
    /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/ // Email addresses
];

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration] });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

client.once('ready', () => {
    console.log(`Bot đã sẵn sàng! Đăng nhập với tên ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'warn') {
        const user = options.getUser('user');
        const reason = options.getString('reason') || 'Không có lý do';

        if (!interaction.member.permissions.has('KickMembers')) {
            return interaction.reply({ content: 'Bạn không có quyền để cảnh báo thành viên.', ephemeral: true });
        }

        try {
            // Trong Discord.js, không có chức năng "cảnh báo" trực tiếp.
            // Thông thường, bạn sẽ gửi tin nhắn cảnh báo đến thành viên hoặc ghi lại vào log.
            await user.send(`Bạn đã bị cảnh báo trong server ${interaction.guild.name} với lý do: ${reason}`);
            await interaction.reply({ content: `Đã cảnh báo ${user.tag} với lý do: ${reason}`, ephemeral: true });
            console.log(`Đã cảnh báo ${user.tag} với lý do: ${reason}`);
        } catch (error) {
            console.error(`Lỗi khi cảnh báo ${user.tag}:`, error);
            await interaction.reply({ content: `Có lỗi xảy ra khi cảnh báo ${user.tag}.`, ephemeral: true });
        }
    } else if (commandName === 'ban') {
        const user = options.getUser('user');
        const reason = options.getString('reason') || 'Không có lý do';

        if (!interaction.member.permissions.has('BanMembers')) {
            return interaction.reply({ content: 'Bạn không có quyền để cấm thành viên.', ephemeral: true });
        }

        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return interaction.reply({ content: 'Không tìm thấy thành viên này trong server.', ephemeral: true });
        }

        try {
            await member.ban({ reason: reason });
            await interaction.reply({ content: `Đã cấm ${user.tag} với lý do: ${reason}`, ephemeral: true });
            console.log(`Đã cấm ${user.tag} với lý do: ${reason}`);
        } catch (error) {
            console.error(`Lỗi khi cấm ${user.tag}:`, error);
            await interaction.reply({ content: `Có lỗi xảy ra khi cấm ${user.tag}.`, ephemeral: true });
        }
    }
});

client.on('guildMemberAdd', member => {
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (welcomeChannel) {
        welcomeChannel.send(`Chào mừng ${member} đã tham gia server!`);
    }

    const defaultRoleId = process.env.DEFAULT_ROLE_ID;
    if (defaultRoleId) {
        const role = member.guild.roles.cache.get(defaultRoleId);
        if (role) {
            member.roles.add(role)
                .then(() => console.log(`Đã gán vai trò ${role.name} cho ${member.user.tag}`))
                .catch(console.error);
        } else {
            console.warn(`Không tìm thấy vai trò với ID: ${defaultRoleId}`);
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return; // Bỏ qua tin nhắn từ bot khác

    // Kiểm tra từ khóa và regex trước
    const messageContent = message.content.toLowerCase();
    let isSpam = false;

    for (const keyword of spamKeywords) {
        if (messageContent.includes(keyword)) {
            isSpam = true;
            break;
        }
    }

    if (!isSpam) {
        for (const regex of spamRegex) {
            if (regex.test(messageContent)) {
                isSpam = true;
                break;
            }
        }
    }

    if (isSpam) {
        if (message.deletable) {
            await message.delete();
            console.log(`Đã xóa tin nhắn spam (từ khóa/regex) từ ${message.author.tag}: "${message.content}"`);
        } else {
            console.warn(`Không thể xóa tin nhắn từ ${message.author.tag} (thiếu quyền hoặc tin nhắn không thể xóa): "${message.content}"`);
        }
        return; // Dừng xử lý nếu đã xác định là spam
    }

    // Nếu không phải spam rõ ràng, gửi đến Gemini AI để phân tích sâu hơn
    try {
        const prompt = `Kiểm tra tin nhắn sau đây có phải là spam hoặc quảng cáo không? Trả lời "SPAM" nếu là spam/quảng cáo, "KHÔNG SPAM" nếu không phải. Tin nhắn: "${message.content}"`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (text.includes('SPAM')) {
            if (message.deletable) {
                await message.delete();
                console.log(`Đã xóa tin nhắn spam (AI) từ ${message.author.tag}: "${message.content}"`);
            } else {
                console.warn(`Không thể xóa tin nhắn từ ${message.author.tag} (thiếu quyền hoặc tin nhắn không thể xóa): "${message.content}"`);
            }
        } else {
            // Nếu không phải spam, bot có thể trả lời hoặc thực hiện các hành động khác
            message.reply(text);
        }
    } catch (error) {
        console.error('Lỗi khi gọi API Gemini hoặc xử lý tin nhắn:', error);
        message.reply('Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này.');
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);