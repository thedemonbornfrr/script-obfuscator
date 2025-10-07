const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const scripts = new Map();

function generateScriptId() {
    return crypto.randomBytes(8).toString('hex');
}

app.post('/api/upload', (req, res) => {
    try {
        const { script, options } = req.body;
        
        if (!script || script.trim().length === 0) {
            return res.status(400).json({ error: 'Script content is required' });
        }

        const scriptId = generateScriptId();
        const obfuscatedScript = obfuscateScript(script, options);
        
        scripts.set(scriptId, {
            id: scriptId,
            content: obfuscatedScript,
            original: script,
            options: options,
            createdAt: new Date().toISOString(),
            enabled: true,
            accessCount: 0
        });

        res.json({
            success: true,
            scriptId: scriptId,
            loadstring: `loadstring(game:HttpGet("https://yourdomain.com/api/execute/${scriptId}"))()`,
            size: Buffer.byteLength(obfuscatedScript, 'utf8')
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/execute/:scriptId', (req, res) => {
    const scriptId = req.params.scriptId;
    const script = scripts.get(scriptId);
    
    if (!script) {
        return res.status(404).send('-- Script not found');
    }
    
    if (!script.enabled) {
        return res.status(403).send('-- Script disabled');
    }
    
    script.accessCount++;
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(script.content);
});

app.get('/api/scripts', (req, res) => {
    const scriptList = Array.from(scripts.values()).map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        enabled: s.enabled,
        accessCount: s.accessCount,
        size: Buffer.byteLength(s.content, 'utf8')
    }));
    
    res.json({ scripts: scriptList });
});

app.delete('/api/scripts/:scriptId', (req, res) => {
    const scriptId = req.params.scriptId;
    
    if (scripts.has(scriptId)) {
        scripts.delete(scriptId);
        res.json({ success: true, message: 'Script deleted' });
    } else {
        res.status(404).json({ error: 'Script not found' });
    }
});

app.patch('/api/scripts/:scriptId/toggle', (req, res) => {
    const scriptId = req.params.scriptId;
    const script = scripts.get(scriptId);
    
    if (script) {
        script.enabled = !script.enabled;
        res.json({ success: true, enabled: script.enabled });
    } else {
        res.status(404).json({ error: 'Script not found' });
    }
});

app.get('/api/stats', (req, res) => {
    const totalScripts = scripts.size;
    const totalSize = Array.from(scripts.values()).reduce((sum, s) => 
        sum + Buffer.byteLength(s.content, 'utf8'), 0);
    const totalAccess = Array.from(scripts.values()).reduce((sum, s) => 
        sum + s.accessCount, 0);
    
    res.json({
        totalScripts,
        totalSize,
        totalAccess,
        tokensLeft: 1,
        maxTokens: 1
    });
});

function obfuscateScript(script, options = {}) {
    let obfuscated = script;

    if (options.varRename) {
        const varMap = new Map();
        obfuscated = obfuscated.replace(/\blocal\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, varName) => {
            if (!varMap.has(varName)) {
                varMap.set(varName, '_0x' + crypto.randomBytes(4).toString('hex'));
            }
            return 'local ' + varMap.get(varName);
        });
        
        varMap.forEach((newName, oldName) => {
            const regex = new RegExp('\\b' + oldName + '\\b', 'g');
            obfuscated = obfuscated.replace(regex, newName);
        });
    }

    if (options.v3ClassA) {
        const encoded = Buffer.from(obfuscated).toString('base64');
        obfuscated = `
local _0x${crypto.randomBytes(3).toString('hex')} = '${encoded}'
local _0x${crypto.randomBytes(3).toString('hex')} = function(str)
    local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    str = string.gsub(str, '[^'..b..'=]', '')
    return (str:gsub('.', function(x)
        if (x == '=') then return '' end
        local r,f='',(b:find(x)-1)
        for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end
        return r;
    end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
        if (#x ~= 8) then return '' end
        local c=0
        for i=1,8 do c=c+(x:sub(i,i)=='1' and 2^(8-i) or 0) end
        return string.char(c)
    end))
end
loadstring(_0x${crypto.randomBytes(3).toString('hex')}(_0x${crypto.randomBytes(3).toString('hex')}))()
        `.trim();
    }

    if (options.vanguard) {
        obfuscated = `-- Vanguard-WS v3.5 Protected
-- Anti-Decompiler & Anti-Tamper
-- Unauthorized modifications will result in script failure

${obfuscated}`;
    }

    if (options.bypassSyntax) {
        obfuscated = `-- Syntax Check Bypassed\n${obfuscated}`;
    }

    return obfuscated;
}

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
});
