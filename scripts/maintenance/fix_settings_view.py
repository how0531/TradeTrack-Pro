
import os
import re

file_path = r"c:\Users\012701\OneDrive - SinoPac\Documents\SinoPac\00.Project\06.SideProject\TradeTrack-Pro\src\features\settings\SettingsView.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix GlassCard Style
glass_card_old = r"""
                bg-[#1A1C20]/40 backdrop-blur-xl 
                border border-white/5 
                shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                rounded-xl"""

glass_card_new = r"""
                bg-zinc-900/60 backdrop-blur-2xl 
                border border-white/10 
                shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)]
                rounded-2xl"""

# Normalize whitespace for matching
def normalize(s):
    return re.sub(r'\s+', ' ', s.strip())

# We use regex to match because whitespace might differ
# Construct regex from old string
glass_card_regex = r"bg-\[#1A1C20\]/40 backdrop-blur-xl\s+border border-white/5\s+shadow-\[0_8px_32px_rgba\(0,0,0,0\.3\)\]\s+rounded-xl"
glass_card_replacement = r"bg-zinc-900/60 backdrop-blur-2xl \n                border border-white/10 \n                shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] \n                rounded-2xl"

content = re.sub(glass_card_regex, glass_card_replacement, content)

# 2. Fix Duplicate GlowSlider
# We know the duplicate starts after the first "};" after Line 85 and ends before "AccountRow".
# The file has:
# ...
# };
# 
# };
# 
# // --- INTERNAL COMPONENT: Glow Slider (Pro Max) ---
# ...
# };// --- INTERNAL COMPONENT: Account Row ---
# const AccountRow ...

# We want to replace everything between the end of GemstoneLight and start of AccountRow with ONE GlowSlider.

# Find the end of GemstoneLight
gemstone_end_marker = "// --- INTERNAL COMPONENT: Gemstone Light (Enhanced with Native Picker) ---"
gemstone_end_idx = content.find(gemstone_end_marker)
# Find the closing bracket of GemstoneLight component. 
# It's hard to parse with regex.
# Instead, let's identify the specific Duplicate block string.
# The duplicate block contains:
# const GlowSlider = ...
# ...
# };
# ...
# const GlowSlider = ...

# We will search for "const GlowSlider ="
matches = [m.start() for m in re.finditer(r"const GlowSlider =", content)]
if len(matches) > 1:
    print(f"Found {len(matches)} GlowSlider definitions. Deduplicating...")
    # Find the start of the first one
    first_start = matches[0]
    # Find the proper place to insert.
    # The first one is likely in the "messy zone".
    # We want to insert it BEFORE AccountRow.
    
    account_row_start = content.find("const AccountRow =")
    
    # We will cut out everything from the first "};" before the first GlowSlider, up to AccountRow start.
    # Look backwards from first_start for "};"
    cut_start = content.rfind("};", 0, first_start)
    if cut_start != -1:
        cut_start += 2 # Include };
    else:
        cut_start = first_start 

    # Clean up the mess
    # Construct the Clean GlowSlider Code
    clean_glow_slider = r"""

// --- INTERNAL COMPONENT: Glow Slider (Pro Max) ---
const GlowSlider = ({ value, min, max, step, onChange, gradientColors }: { value: number, min: number, max: number, step: number, onChange: (val: number) => void, gradientColors: string[] }) => {
    const percent = ((value - min) / (max - min)) * 100;
    const activeColor = gradientColors[1] || gradientColors[0];
    
    return (
        <div className="relative flex items-center h-6 group select-none w-full">
            {/* Track Background */}
            <div className="absolute w-full h-1.5 rounded-lg bg-white/5 overflow-hidden">
                 <div 
                    className="h-full transition-all duration-100 ease-out"
                    style={{ 
                        width: `${percent}%`,
                        background: `linear-gradient(to right, ${gradientColors.join(', ')})` 
                    }}
                 />
            </div>
            
            {/* Thumb with Glow */}
            <div 
                className="absolute h-4 w-4 rounded-full bg-white shadow-lg pointer-events-none transition-all duration-100 ease-out flex items-center justify-center z-10"
                style={{ 
                    left: `calc(${percent}% - 8px)`,
                    boxShadow: `0 0 15px ${activeColor}88`,
                    border: `2px solid ${activeColor}`
                }}
            >
                <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
            </div>

            {/* Hidden Input for Interaction */}
            <input 
                type="range" 
                min={min} 
                max={max} 
                step={step} 
                value={value} 
                onChange={(e) => onChange(Number(e.target.value))} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
        </div>
    );
};

// --- INTERNAL COMPONENT: Account Row ---
"""
    # Replace the chunk
    # Identify the range to replace: from cut_start to account_row_start
    # Also include the "// --- INTERNAL COMPONENT: Account Row ---" before const AccountRow if it exists, to avoid duplication.
    
    # Check if Account Row comment is already there
    comment_header = "// --- INTERNAL COMPONENT: Account Row ---"
    comment_idx = content.rfind(comment_header, 0, account_row_start)
    
    if comment_idx != -1 and comment_idx > cut_start:
        # The comment is in the "to be replaced" zone or just after?
        # If it is just before AccountRow, we should include it in replacement range to ensure we have a clean header.
        replace_end = account_row_start
        # We will replace [cut_start : replace_end]
        content = content[:cut_start] + clean_glow_slider + content[replace_end:]
    else:
        # Comment might be missing or we construct it
        replace_end = account_row_start
        content = content[:cut_start] + clean_glow_slider + content[replace_end:]

# 3. Add magnetic button hover
add_btn_regex = r'onClick=\{\(\) => setIsAdding\(true\)\}\s+className="([^"]+)"'
def add_btn_repl(m):
    cls = m.group(1)
    if "hover:scale" not in cls:
        cls = cls.replace("transition-all", "transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]")
        # Update styling
        cls = cls.replace("hover:border-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/10", "hover:border-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30")
        cls = cls.replace("group-hover:scale-110", "group-hover:scale-110 duration-300")
    return f'onClick={{() => setIsAdding(true)}} className="{cls}"'

content = re.sub(add_btn_regex, add_btn_repl, content)

# 4. Use GlowSlider in Risk Management
# DD Threshold
content = re.sub(
    r'<input type="range" min="5" max="50" step="1" value=\{ddThreshold\} [^>]+>',
    r'<GlowSlider min={5} max={50} step={1} value={ddThreshold} onChange={setDdThreshold} gradientColors={[THEME.GREEN_DARK, THEME.GREEN]} />',
    content
)

# Loss Streak
content = re.sub(
    r'<input type="range" min="2" max="10" step="1" value=\{maxLossStreak\} [^>]+>',
    r'<GlowSlider min={2} max={10} step={1} value={maxLossStreak} onChange={setMaxLossStreak} gradientColors={["#A08C65", "#C8B085"]} />',
    content
)

# 5. Account Row Capital Input Font
# className="bg-transparent outline-none w-32 hover:text-zinc-300 focus:text-zinc-200 transition-colors"
# Add font-barlow-numeric
content = content.replace(
    'className="bg-transparent outline-none w-32 hover:text-zinc-300 focus:text-zinc-200 transition-colors"',
    'className="bg-transparent outline-none w-32 hover:text-zinc-300 focus:text-zinc-200 transition-colors font-barlow-numeric tracking-wider"'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SettingsView.tsx patched successfully.")
