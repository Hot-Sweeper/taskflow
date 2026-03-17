// Auto-generated Character Generator
window.CharacterGenerator = (function() {
    const COLORS = {
        skin: {
            light: '#FFDBAC',
            medium: '#F1C27D',
            dark: '#8D5524',
            verydark: '#3d2210'
        },
        hair: {
            black: '#1f1b18',
            brown: '#5c3a21',
            blonde: '#e2ba71',
            red: '#962b09'
        }
    };

    function getStyles() {
        return `
        <style>
            @keyframes zzz {
                0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
                50% { opacity: 1; transform: translate(15px, -20px) scale(1); }
                100% { opacity: 0; transform: translate(30px, -40px) scale(1.5); }
            }
            @keyframes typeLeft {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(5deg); }
            }
            @keyframes typeRight {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(-5deg); }
            }
            @keyframes steam {
                0% { opacity: 0; transform: translateY(0); }
                50% { opacity: 0.8; transform: translateY(-10px); }
                100% { opacity: 0; transform: translateY(-20px); }
            }
            @keyframes blink {
                0%, 96%, 100% { transform: scaleY(1); }
                98% { transform: scaleY(0.1); }
            }
            @keyframes breathe {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
            }
            
            .anim-zzz-1 { animation: zzz 3s infinite; }
            .anim-zzz-2 { animation: zzz 3s infinite 1s; }
            .anim-zzz-3 { animation: zzz 3s infinite 2s; }
            .anim-type-l { animation: typeLeft 0.3s infinite; transform-origin: 80px 110px; }
            .anim-type-r { animation: typeRight 0.25s infinite; transform-origin: 120px 110px; }
            .anim-steam-1 { animation: steam 2s infinite; }
            .anim-steam-2 { animation: steam 2s infinite 1.5s; }
            .eyes-blink { animation: blink 4s infinite; transform-origin: center; }
            .breathe { animation: breathe 3s infinite; transform-origin: center 150px; }
        </style>`;
    }

    function renderHair(style, color) {
        if (style === 'bald') return '';
        if (style === 'short') {
            return `
                <!-- Short hair -->
                <path d="M75,70 Q100,45 125,70 Q130,90 125,100 L75,100 Q70,90 75,70 Z" fill="${color}" />
                <path d="M75,70 Q100,55 125,75" stroke="${color}" stroke-width="4" stroke-linecap="round" />
            `;
        }
        if (style === 'long') {
            return `
                <!-- Long hair back -->
                <path d="M70,80 Q65,130 75,140 L125,140 Q135,130 130,80 Z" fill="${color}" />
                <!-- Long hair front -->
                <path d="M70,80 Q100,40 130,80 Q135,100 128,110 L72,110 Q65,100 70,80 Z" fill="${color}" />
            `;
        }
        if (style === 'curly') {
            return `
                <!-- Curly hair base -->
                <circle cx="85" cy="65" r="15" fill="${color}" />
                <circle cx="100" cy="58" r="18" fill="${color}" />
                <circle cx="115" cy="65" r="15" fill="${color}" />
                <circle cx="75" cy="80" r="14" fill="${color}" />
                <circle cx="125" cy="80" r="14" fill="${color}" />
                <circle cx="72" cy="95" r="12" fill="${color}" />
                <circle cx="128" cy="95" r="12" fill="${color}" />
            `;
        }
        return '';
    }

    function renderGlasses() {
        return `
            <!-- Glasses -->
            <path d="M78,85 L92,85 L92,95 L78,95 Z" fill="rgba(255,255,255,0.3)" stroke="#333" stroke-width="2" rx="3" />
            <path d="M108,85 L122,85 L122,95 L108,95 Z" fill="rgba(255,255,255,0.3)" stroke="#333" stroke-width="2" rx="3" />
            <line x1="92" y1="90" x2="108" y2="90" stroke="#333" stroke-width="2" />
            <line x1="72" y1="88" x2="78" y2="88" stroke="#333" stroke-width="2" />
            <line x1="122" y1="88" x2="128" y2="88" stroke="#333" stroke-width="2" />
        `;
    }

    function getFace(state) {
        if (state === 'offline') {
            return `
                <!-- Sleeping eyes -->
                <path d="M80,90 Q85,95 90,90" stroke="#444" stroke-width="2" fill="none" stroke-linecap="round" />
                <path d="M110,90 Q115,95 120,90" stroke="#444" stroke-width="2" fill="none" stroke-linecap="round" />
                <!-- Sleeping mouth -->
                <circle cx="100" cy="105" r="3" fill="#444" />
            `;
        }
        return `
            <!-- Open eyes -->
            <g class="eyes-blink">
                <circle cx="85" cy="90" r="3" fill="#333" />
                <circle cx="115" cy="90" r="3" fill="#333" />
            </g>
            <!-- Smile mouth -->
            <path d="M93,103 Q100,108 107,103" stroke="#444" stroke-width="2" fill="none" stroke-linecap="round" />
        `;
    }

    function render(options, state) {
        const toneHex = COLORS.skin[options.skinTone] || options.skinTone || COLORS.skin.medium;
        const hairHex = COLORS.hair[options.hairColor] || options.hairColor || COLORS.hair.black;
        const shirtHex = options.shirtColor || '#4CAF50';
        
        const hasGlasses = options.glasses === true;
        const styleHair = options.hairStyle || 'short';

        let innerScene = '';

        if (state === 'offline') {
            // Bed/Sleeping scene
            innerScene = `
                <!-- Bed Base -->
                <rect x="30" y="150" width="140" height="30" rx="5" fill="#5c8a8a" />
                <rect x="30" y="140" width="140" height="20" rx="10" fill="#a3c2c2" />
                
                <!-- Body sleeping -->
                <path class="breathe" d="M60,150 Q100,120 140,150 Z" fill="${shirtHex}" />
                
                <!-- Head sleeping -->
                <g transform="translate(-10, 30) rotate(-15 100 100)">
                    ${renderHair(styleHair === 'long' ? 'short' : styleHair, hairHex)}
                    <rect x="75" y="65" width="50" height="55" rx="20" fill="${toneHex}" />
                    ${getFace('offline')}
                    ${hasGlasses ? renderGlasses() : ''}
                </g>

                <!-- Blanket -->
                <path d="M40,140 Q100,130 160,140 L160,170 L40,170 Z" fill="#dddddd" />
                
                <!-- Zzzs -->
                <g fill="#555" font-family="Arial" font-weight="bold">
                    <text x="130" y="80" font-size="14" class="anim-zzz-1">Z</text>
                    <text x="135" y="60" font-size="18" class="anim-zzz-2">z</text>
                    <text x="145" y="40" font-size="24" class="anim-zzz-3">z</text>
                </g>
            `;
        } else if (state === 'working-office') {
            // Desk and PC
            innerScene = `
                <!-- Office Chair back -->
                <rect x="75" y="80" width="50" height="80" rx="10" fill="#333" />
                
                <!-- Body -->
                <path class="breathe" d="M65,160 Q100,110 135,160 Z" fill="${shirtHex}" />

                <!-- Desk Base -->
                <rect x="20" y="150" width="160" height="50" fill="#a67c52" />
                <rect x="15" y="145" width="170" height="5" fill="#8b5a2b" />
                
                <!-- Monitor -->
                <rect x="60" y="90" width="80" height="45" rx="3" fill="#e0e0e0" />
                <rect x="65" y="95" width="70" height="35" rx="1" fill="#99ccff" opacity="0.8" />
                <rect x="95" y="135" width="10" height="15" fill="#bbb" />
                <rect x="80" y="145" width="40" height="5" fill="#999" />
                
                <!-- Keyboard -->
                <rect x="65" y="152" width="50" height="12" rx="2" fill="#ddd" transform="skewX(-20)" />
                
                <!-- Mouse -->
                <rect x="130" y="153" width="12" height="18" rx="6" fill="#ddd" />
                
                <!-- Head peeking over monitor slightly -->
                <g transform="translate(0, -10)">
                    <!-- Neck -->
                    <rect x="93" y="110" width="14" height="20" fill="${toneHex}" />
                    ${renderHair(styleHair, hairHex)}
                    <rect x="75" y="65" width="50" height="55" rx="20" fill="${toneHex}" />
                    ${getFace(state)}
                    ${hasGlasses ? renderGlasses() : ''}
                </g>

                <!-- Typing Arms -->
                <path class="anim-type-l" d="M70,140 Q80,150 75,160" stroke="${toneHex}" stroke-width="12" stroke-linecap="round" fill="none" />
                <path class="anim-type-r" d="M130,140 Q130,150 135,160" stroke="${toneHex}" stroke-width="12" stroke-linecap="round" fill="none" />
            `;
        } else if (state === 'working-home') {
            // Sofa and laptop
            innerScene = `
                <!-- Sofa -->
                <rect x="20" y="120" width="160" height="60" rx="10" fill="#f09075" />
                <rect x="10" y="140" width="20" height="40" rx="5" fill="#d9755b" />
                <rect x="170" y="140" width="20" height="40" rx="5" fill="#d9755b" />

                <!-- Legs/Sweatpants -->
                <path d="M80,150 L60,180 L75,180 L90,150 Z" fill="#78909c" />
                <path d="M120,150 L140,180 L125,180 L110,150 Z" fill="#78909c" />

                <!-- Body -->
                <path class="breathe" d="M65,150 Q100,105 135,150 Z" fill="${shirtHex}" />

                <g transform="translate(0, 0)">
                    <!-- Neck -->
                    <rect x="93" y="110" width="14" height="20" fill="${toneHex}" />
                    ${renderHair(styleHair, hairHex)}
                    <rect x="75" y="65" width="50" height="55" rx="20" fill="${toneHex}" />
                    ${getFace(state)}
                    ${hasGlasses ? renderGlasses() : ''}
                </g>

                <!-- Laptop on lap -->
                <rect x="75" y="145" width="50" height="30" rx="2" fill="#dcdcdc" />
                <polygon points="70,175 130,175 140,185 60,185" fill="#b0b0b0" />
                <ellipse cx="100" cy="160" rx="5" ry="5" fill="#ffffff" opacity="0.6"/>

                <!-- Home Typing Arms -->
                <path class="anim-type-l" d="M70,135 Q75,160 85,175" stroke="${toneHex}" stroke-width="10" stroke-linecap="round" fill="none" />
                <path class="anim-type-r" d="M130,135 Q125,160 115,175" stroke="${toneHex}" stroke-width="10" stroke-linecap="round" fill="none" />
            `;
        } else if (state === 'break') {
            // Standing with coffee
            innerScene = `
                <!-- Body -->
                <path class="breathe" d="M65,180 Q100,100 135,180 Z" fill="${shirtHex}" />

                <g transform="translate(0, -10)">
                    <!-- Neck -->
                    <rect x="93" y="110" width="14" height="20" fill="${toneHex}" />
                    ${renderHair(styleHair, hairHex)}
                    <rect x="75" y="65" width="50" height="55" rx="20" fill="${toneHex}" />
                    ${getFace('break')}
                    ${hasGlasses ? renderGlasses() : ''}
                </g>

                <!-- Left Arm resting -->
                <path d="M68,135 Q55,160 65,180" stroke="${shirtHex}" stroke-width="12" stroke-linecap="round" fill="none" />
                <path d="M65,180 L65,185" stroke="${toneHex}" stroke-width="10" stroke-linecap="round" />

                <!-- Right Arm holding coffee -->
                <path d="M132,135 Q145,150 115,160" stroke="${shirtHex}" stroke-width="12" stroke-linecap="round" fill="none" />
                <path d="M115,160 L110,158" stroke="${toneHex}" stroke-width="10" stroke-linecap="round" />

                <!-- Coffee Cup -->
                <rect x="95" y="145" width="15" height="20" rx="2" fill="#fff" />
                <path d="M110,150 Q115,155 110,160" stroke="#fff" stroke-width="2" fill="none" />
                <rect x="95" y="152" width="15" height="5" fill="#8d6e63" />

                <!-- Steam -->
                <path class="anim-steam-1" d="M100,140 Q95,130 100,120 M105,140 Q110,130 105,120" stroke="rgba(255,255,255,0.6)" stroke-width="2" fill="none" stroke-linecap="round" />
            `;
        } else {
             // Fallback minimal
             innerScene = `
                <!-- Body -->
                <path class="breathe" d="M65,180 Q100,100 135,180 Z" fill="${shirtHex}" />
                <g transform="translate(0, -10)">
                    <rect x="93" y="110" width="14" height="20" fill="${toneHex}" />
                    ${renderHair(styleHair, hairHex)}
                    <rect x="75" y="65" width="50" height="55" rx="20" fill="${toneHex}" />
                    ${getFace(state)}
                    ${hasGlasses ? renderGlasses() : ''}
                </g>
             `;
        }

        const fullSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
                ${getStyles()}
                <rect width="200" height="200" fill="transparent" />
                ${innerScene}
            </svg>
        `;

        return fullSvg.trim();
    }

    return {
        render,
        getStyles,
        COLORS
    };
})();
