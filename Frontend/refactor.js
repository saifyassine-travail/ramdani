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

// 2) Replace outer grid wrapper  
// Original: <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
content = content.replace(
    '        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">',
    '        <ResizablePanelGroup direction="horizontal" className="hidden xl:flex items-stretch min-h-[800px] mb-6">'
);

// 3) Replace LEFT column wrapper (col-span-3 => 25% panel)
// The left column uses col-span-3
content = content.replace(
    '          {/* LEFT COLUMN: Description du Cas - 3 columns */}\n          <div className="xl:col-span-3 space-y-6">',
    '          {/* LEFT PANEL */}\n          <ResizablePanel defaultSize={25} minSize={20}>\n            <div className="h-full overflow-y-auto space-y-6 pr-2">'
);

// 4) Replace LEFT close + MIDDLE open
// Left col-span-3 closes, then MIDDLE col-span-6 opens
content = content.replace(
    '          </div>\n\n          {/* MIDDLE COLUMN: Plan de Traitement & Demandes d\'Analyses - 6 columns */}\n          <div className="xl:col-span-6 space-y-6">',
    '            </div>\n          </ResizablePanel>\n\n          <ResizableHandle withHandle className="w-1.5 bg-blue-100 hover:bg-blue-300 cursor-col-resize transition-colors" />\n\n          {/* MIDDLE PANEL */}\n          <ResizablePanel defaultSize={50} minSize={30}>\n            <div className="h-full overflow-y-auto space-y-6 px-2">'
);

// 5) Replace MIDDLE close + RIGHT open  
content = content.replace(
    '          </div>\n\n          {/* RIGHT COLUMN: Rendez-vous précédent - 3 columns */}\n          <div className="xl:col-span-3 space-y-6">',
    '            </div>\n          </ResizablePanel>\n\n          <ResizableHandle withHandle className="w-1.5 bg-blue-100 hover:bg-blue-300 cursor-col-resize transition-colors" />\n\n          {/* RIGHT PANEL */}\n          <ResizablePanel defaultSize={25} minSize={20}>\n            <div className="h-full overflow-y-auto space-y-6 pl-2">'
);

// 6) Replace closing of right column + grid wrapper
content = content.replace(
    '          </div>\n        </div>\n\n        <div className="flex justify-end space-x-4 mt-6 pb-8">',
    '            </div>\n          </ResizablePanel>\n        </ResizablePanelGroup>\n\n        {/* Mobile/Tablet layout */}\n        <div className="xl:hidden mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">\n          <p className="text-sm text-blue-700">Interface optimisée pour grand écran. Veuillez agrandir votre fenêtre.</p>\n        </div>\n\n        <div className="flex justify-end space-x-4 mt-6 pb-8">'
);

fs.writeFileSync(file, content);
console.log("Done. Verifying replacements...");

// Verify all were applied
const checks = [
    ['ResizablePanelGroup', 'ResizablePanelGroup correctly inserted'],
    ['ResizablePanel defaultSize={25}', 'LEFT panel (25%) present'],
    ['ResizablePanel defaultSize={50}', 'MIDDLE panel (50%) present'],
    ['ResizableHandle withHandle', 'ResizableHandle present'],
    ['xl:col-span', 'No leftover col-span (should be 0)'],
    ['grid-cols-12', 'No leftover grid-cols-12 (should be 0)'],
];

const final = require('fs').readFileSync(file, 'utf8');
checks.forEach(([term, desc]) => {
    const count = (final.match(new RegExp(term, 'g')) || []).length;
    const shouldBeZero = desc.includes('should be 0');
    const status = shouldBeZero ? (count === 0 ? 'OK' : 'FAIL') : (count > 0 ? 'OK' : 'FAIL');
    console.log(`${status} (${count}x): ${desc}`);
});
