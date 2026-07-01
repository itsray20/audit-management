const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Replace the wrapper
code = code.replace(
  /<div className=\{\`transition-all duration-300 \$\{selectedItem \? 'w-full lg:w-2\/3' : 'w-full'\}\`\}>/,
  '<div className="w-full">'
);

// 2. Replace the DetailsPanel section
const oldDetailPanelStr = `{/* Detail Panel */}
                  {selectedItem && (
                    <>
                      <div className="lg:hidden fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end justify-center animate-fade-in" onClick={() => setSelectedItem(null)}>
                        <div className="w-full max-h-[85vh] rounded-t-3xl overflow-hidden shadow-2xl relative animate-slide-up" style={{ background: 'var(--card-solid)', borderTop: '1px solid var(--glass-border)', boxShadow: '0 -8px 36px rgba(0,0,0,0.30)' }} onClick={e => e.stopPropagation()}>
                          <div className="w-12 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto my-3 pointer-events-none" />
                          <div className="overflow-y-auto h-[calc(85vh-20px)]">
                            <DetailsPanel item={selectedItem} currentUser={currentUser} auditIsLocked={auditIsLocked} onClose={() => setSelectedItem(null)} onUpdate={() => { fetchItems(); fetchDashboardMetrics(); }} isDark={isDark} roleNamesMap={roleNamesMap} />
                          </div>
                        </div>
                      </div>
                      <div className="hidden lg:block lg:w-1/3 lg:sticky lg:top-20 h-[85vh] overflow-hidden rounded-2xl" style={{ border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                        <DetailsPanel item={selectedItem} currentUser={currentUser} auditIsLocked={auditIsLocked} onClose={() => setSelectedItem(null)} onUpdate={() => { fetchItems(); fetchDashboardMetrics(); }} isDark={isDark} roleNamesMap={roleNamesMap} />
                      </div>
                    </>
                  )}`;

const newDetailPanelStr = `{/* Detail Panel Modal */}
                  {selectedItem && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in" onClick={() => setSelectedItem(null)}>
                      <div 
                        className="w-full max-w-4xl max-h-[90vh] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl relative animate-scale-up flex flex-col" 
                        style={{ background: 'var(--card-solid)', border: '1px solid var(--glass-border)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }} 
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                          <DetailsPanel item={selectedItem} currentUser={currentUser} auditIsLocked={auditIsLocked} onClose={() => setSelectedItem(null)} onUpdate={() => { fetchItems(); fetchDashboardMetrics(); }} isDark={isDark} roleNamesMap={roleNamesMap} />
                        </div>
                      </div>
                    </div>
                  )}`;

if (code.includes(oldDetailPanelStr)) {
  code = code.replace(oldDetailPanelStr, newDetailPanelStr);
  fs.writeFileSync('src/App.jsx', code);
  console.log('Successfully replaced DetailsPanel logic.');
} else {
  console.log('Could not find old detail panel string.');
}
