const fs = require('fs');
const file = 'c:/Users/Saif/Desktop/ramdani/ramdani/Frontend/app/appointments/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1) Add Resizable import after Card import
const cardImport = 'import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"';
if (!content.includes('ResizablePanelGroup')) {
    content = content.replace(
        cardImport,
        cardImport + '\nimport { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../../../components/ui/resizable"'
    );
}

// Detect the actual column class names in the file so we can match exactly
const leftColMatch = content.match(/xl:col-span-(\d+) space-y-6">/g);
console.log('Column spans found:', leftColMatch);

// Find what column spans are used
let gridIdx = content.indexOf('grid-cols-1 xl:grid-cols-12');
let gridStart = content.lastIndexOf('\n', gridIdx) + 1;
let gridOpenTag = content.substring(gridStart, gridIdx + 80);
console.log('Grid open tag:', JSON.stringify(gridOpenTag));
