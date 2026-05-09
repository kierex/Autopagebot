// Track command from frontend demo
app.post('/api/track-command', (req, res) => {
    const { commandName, userId } = req.body;
    if (commandName) {
        commandStats.commandUsage[commandName] = (commandStats.commandUsage[commandName] || 0) + 1;
        commandStats.totalCommandsExecuted++;
        saveCommandStats();
        
        if (userId && !userStats.uniqueUsers.includes(userId)) {
            userStats.uniqueUsers.push(userId);
            saveUserStats();
        }
        
        console.log(`📈 Demo command tracked: ${commandName}`);
        res.json({ success: true, message: `Tracked: ${commandName}` });
    } else {
        res.status(400).json({ error: 'Command name required' });
    }
});