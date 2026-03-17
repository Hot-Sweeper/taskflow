// Test that the renderConvos template works correctly
function esc(s) { 
  if (!s) return ''; 
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); 
}

const c = {
  userId: '842eab2d-1d11-4a2b-9d07-64207ef320b1',
  userName: 'boss',
  userAvatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?skinColor=f2d3b1&hair=short01&hairProbability=100&hairColor=562306'
};

const currentChatPartner = null;

// Exact template from renderConvos in worker/index.html
const html = `
    <div class="chat-conv-item${currentChatPartner === c.userId ? ' active' : ''}" onclick="openConvo('${c.userId}','${esc(c.userName)}')">
      <div class="worker-avatar">${c.userAvatarUrl ? `<img src="${esc(c.userAvatarUrl)}" alt="" onerror="this.replaceWith(document.createTextNode('${(c.userName||'?')[0].toUpperCase()}'))" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : (c.userName?.[0]?.toUpperCase() || '?')}</div>
      <div style="flex:1;overflow:hidden;">
        <div style="font-weight:600;">${esc(c.userName)}</div>
      </div>
    </div>`;

console.log('Generated HTML:');
console.log(html);
console.log('---');
console.log('Contains img tag:', html.includes('<img'));
console.log('src attribute OK:', html.includes('src="https://'));
console.log('onerror present:', html.includes('onerror'));

// Check the src value - does esc() break the URL inside the src attr?
const srcMatch = html.match(/src="([^"]+)"/);
if (srcMatch) {
  console.log('\nEscaped src value:', srcMatch[1]);
  console.log('Contains &amp;:', srcMatch[1].includes('&amp;'));
  console.log('This is CORRECT for HTML - browser will parse &amp; back to &');
}

// Also test the onerror handler
const onerrorMatch = html.match(/onerror="([^"]+)"/);
if (onerrorMatch) {
  console.log('\nonerror value:', onerrorMatch[1]);
}
