
import os
import re

file_path = r"c:\Users\012701\OneDrive - SinoPac\Documents\SinoPac\00.Project\06.SideProject\TradeTrack-Pro\src\features\settings\SettingsView.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add CurrencyInput Component
# We'll insert it before AccountRow
currency_input_code = r"""
// --- INTERNAL COMPONENT: Currency Input ---
const CurrencyInput = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
    const [isFocused, setIsFocused] = useState(false);
    const displayValue = isFocused ? value : Number(value).toLocaleString();

    return (
        <input
            type="text"
            value={displayValue}
            onChange={(e) => {
                const val = e.target.value.replace(/,/g, '');
                if (!isNaN(Number(val))) onChange(val);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={className}
        />
    );
};

"""

# Insert before AccountRow if not already present
if "const CurrencyInput =" not in content:
    content = content.replace("// --- INTERNAL COMPONENT: Account Row ---", currency_input_code + "// --- INTERNAL COMPONENT: Account Row ---")

# 2. Replace Capital Input in AccountRow
# Find the exact input block
old_input_regex = r'<input\s+type="number"\s+value=\{tempCapital\}\s+onChange=\{\(e\) => handleSaveCapital\(e\.target\.value\)\}\s+className="([^"]+)"\s+/>'
match = re.search(old_input_regex, content)

if match:
    old_class = match.group(1)
    # Ensure font-barlow-numeric is there (it was added in previous step, but let's be safe)
    if "font-barlow-numeric" not in old_class:
        old_class += " font-barlow-numeric tracking-wider"
    
    new_input = f'<CurrencyInput value={{tempCapital}} onChange={{handleSaveCapital}} className="{old_class}" />'
    content = content.replace(match.group(0), new_input)
    print("CurrencyInput replaced.")
else:
    print("Could not find old Capital Input. checking manual replacement...")
    # Fallback search if attributes order is different
    # Try a broader search or skip if already done

# 3. Enhance GemstoneLight with Glow
# Look for boxShadow: `0 0 10px ${color}66, inset 0 2px 4px rgba(255,255,255,0.3)`
gemstone_shadow_regex = r'boxShadow: `0 0 10px \$\{color\}66, inset 0 2px 4px rgba\(255,255,255,0\.3\)`'
new_gemstone_shadow = r'boxShadow: `0 0 15px ${color}88, inset 0 2px 4px rgba(255,255,255,0.3), 0 0 30px ${color}44`' # Stronger glow

if re.search(gemstone_shadow_regex, content):
    content = re.sub(gemstone_shadow_regex, new_gemstone_shadow, content)
    print("Gemstone glow enhanced.")

# 4. Implement SlidingGlassToggle for Language
# Identify the block
lang_block_regex = r'<div className="flex bg-black p-1 rounded-lg border border-white/10">\s+<button onClick=\{\(\) => setLang\(\'en\'\)\}.*?</button>\s+<button onClick=\{\(\) => setLang\(\'zh\'\)\}.*?</button>\s+</div>'

# It's multiline, so we need re.DOTALL
match_lang = re.search(lang_block_regex, content, re.DOTALL)

if match_lang:
    print("Found Language Toggle block.")
    new_lang_toggle = r"""<div className="relative flex bg-black/40 p-1 rounded-lg border border-white/10 w-[140px] h-[36px]">
                             {/* Sliding Background */}
                             <div 
                                 className="absolute top-1 bottom-1 rounded-md bg-[#25282C] border border-white/10 shadow-sm transition-all duration-300 ease-out"
                                 style={{ 
                                     left: lang === 'en' ? '4px' : '50%', 
                                     width: 'calc(50% - 4px)',
                                     transform: lang === 'zh' ? 'translateX(0)' : 'translateX(0)' 
                                 }}
                             />
                             
                             <button 
                                 onClick={() => setLang('en')} 
                                 className={`relative z-10 flex-1 text-[10px] font-bold transition-colors duration-300 ${lang === 'en' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                             >
                                 EN
                             </button>
                             <button 
                                 onClick={() => setLang('zh')} 
                                 className={`relative z-10 flex-1 text-[10px] font-bold transition-colors duration-300 ${lang === 'zh' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                             >
                                 中文
                             </button>
                         </div>"""
    
    content = content.replace(match_lang.group(0), new_lang_toggle)
    print("Language Toggle updated to Sliding Glass.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SettingsView.tsx optimizations applied.")
