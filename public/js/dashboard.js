document.addEventListener('DOMContentLoaded', () => {
    // Auth & Navigation elements
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Config elements
    const guildSelect = document.getElementById('guildSelect');
    const channelSelect = document.getElementById('channelSelect');
    const welcomeEnabled = document.getElementById('welcomeEnabled');
    const messageTemplate = document.getElementById('messageTemplate');
    const bgUrl = document.getElementById('bgUrl');
    const cardTitle = document.getElementById('cardTitle');
    const cardSubtitle = document.getElementById('cardSubtitle');
    const textColorPicker = document.getElementById('textColorPicker');
    const textColorHex = document.getElementById('textColorHex');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    
    // Mistral AI elements
    const aiAssistBtn = document.getElementById('aiAssistBtn');
    const aiEnabled = document.getElementById('aiEnabled');
    const aiConfigFields = document.getElementById('aiConfigFields');
    const aiPrompt = document.getElementById('aiPrompt');
    const aiModel = document.getElementById('aiModel');
    
    // Action buttons
    const testCardBtn = document.getElementById('testCardBtn');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    
    // Live Preview elements
    const previewTextMsg = document.getElementById('previewTextMsg');
    const previewCardBg = document.getElementById('previewCardBg');
    const previewCardTitle = document.getElementById('previewCardTitle');
    const previewCardMemberName = document.getElementById('previewCardMemberName');
    const previewCardSubtitle = document.getElementById('previewCardSubtitle');
    
    // Toasts
    const toastContainer = document.getElementById('toastContainer');
    
    let loadedGuilds = [];
    let currentGuildConfig = null;

    // Toast Utility
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconSvg = type === 'success' 
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

        toast.innerHTML = `
            ${iconSvg}
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Trigger reflow for animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // 1. AUTH CHECK
    function checkAuth() {
        fetch('/api/auth/check')
            .then(res => res.json())
            .then(data => {
                if (!data.isAuthenticated) {
                    window.location.href = '/login.html';
                } else {
                    loadBotGuilds();
                }
            })
            .catch(err => {
                console.error('Auth check error:', err);
                window.location.href = '/login.html';
            });
    }

    // 2. FETCH DISCORD SERVERS & CHANNELS
    async function loadBotGuilds() {
        try {
            const response = await fetch('/api/bot/guilds');
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to fetch servers');
            }
            
            const data = await response.json();
            loadedGuilds = data.guilds;
            
            // Clear select
            guildSelect.innerHTML = '<option value="">-- Sélectionnez un serveur Discord --</option>';
            
            if (loadedGuilds.length === 0) {
                guildSelect.innerHTML = '<option value="">Aucun serveur trouvé. Ajoutez le bot à un serveur !</option>';
                showToast('Le bot n\'est dans aucun serveur Discord.', 'error');
                return;
            }
            
            loadedGuilds.forEach(guild => {
                const option = document.createElement('option');
                option.value = guild.id;
                option.textContent = guild.name;
                guildSelect.appendChild(option);
            });
            
            showToast('Serveurs chargés avec succès !', 'success');
        } catch (err) {
            console.error('Error loading bot guilds:', err);
            showToast(`Erreur bot : ${err.message}. Assurez-vous que le bot est allumé.`, 'error');
        }
    }

    // 3. SWITCH SERVERS AND LOAD CONFIG
    guildSelect.addEventListener('change', async (e) => {
        const guildId = e.target.value;
        
        if (!guildId) {
            resetConfigForm();
            return;
        }
        
        const guild = loadedGuilds.find(g => g.id === guildId);
        
        // Populate channels select
        channelSelect.innerHTML = '<option value="">-- Sélectionnez un salon --</option>';
        channelSelect.disabled = false;
        
        if (guild && guild.channels && guild.channels.length > 0) {
            guild.channels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.id;
                option.textContent = `# ${channel.name}`;
                channelSelect.appendChild(option);
            });
        } else {
            channelSelect.innerHTML = '<option value="">Aucun salon textuel trouvé</option>';
        }
        
        // Fetch Supabase configuration for this guild
        try {
            const response = await fetch(`/api/config/${guildId}`);
            if (!response.ok) throw new Error('Impossible de charger la configuration.');
            
            const config = await response.json();
            currentGuildConfig = config;
            
            // Populate inputs
            welcomeEnabled.checked = config.is_enabled;
            channelSelect.value = config.channel_id || '';
            messageTemplate.value = config.message_template || 'مرحباً بك {user} في السيرفر! يرجى الانتظار حتى يتم التحقق من حسابك. 🛡️';
            bgUrl.value = config.background_url || '';
            cardTitle.value = config.card_title || 'BIENVENUE';
            cardSubtitle.value = config.card_subtitle || 'Membre n°{count}';
            
            const color = config.text_color || '#dbc3ff';
            textColorPicker.value = color;
            textColorHex.value = color.toUpperCase();
            
            // Enable Actions Buttons
            testCardBtn.disabled = false;
            saveConfigBtn.disabled = false;
            aiAssistBtn.disabled = false;
            
            // Populate AI inputs
            aiEnabled.checked = config.is_ai_enabled || false;
            aiPrompt.value = config.ai_prompt || 'Tu es un hôte chaleureux. Accueille le membre {user} sur le serveur {guild} en français de façon amicale et créative.';
            aiModel.value = config.ai_model || 'open-mistral-7b';
            
            if (config.is_ai_enabled) {
                aiConfigFields.style.display = 'block';
            } else {
                aiConfigFields.style.display = 'none';
            }
            
            // Update Preview
            updateLivePreview();
            showToast(`Configuration chargée pour le serveur : ${guild.name}`, 'success');
        } catch (err) {
            console.error('Error loading configuration:', err);
            showToast('Erreur lors du chargement de la configuration.', 'error');
        }
    });

    function resetConfigForm() {
        channelSelect.innerHTML = '<option value="">Sélectionnez un serveur d\'abord</option>';
        channelSelect.disabled = true;
        welcomeEnabled.checked = true;
        messageTemplate.value = '';
        bgUrl.value = '';
        cardTitle.value = '';
        cardSubtitle.value = '';
        textColorPicker.value = '#dbc3ff';
        textColorHex.value = '#DBC3FF';
        testCardBtn.disabled = true;
        saveConfigBtn.disabled = true;
        
        // AI element resets
        aiEnabled.checked = false;
        aiPrompt.value = '';
        aiModel.value = 'open-mistral-7b';
        aiConfigFields.style.display = 'none';
        aiAssistBtn.disabled = true;
        
        currentGuildConfig = null;
        updateLivePreview();
    }

    // 4. LIVE PREVIEW UPDATE LOGIC WITH DYNAMIC VISUAL STYLING
    function updateLivePreview() {
        const guildId = guildSelect.value;
        const guildName = guildId ? guildSelect.options[guildSelect.selectedIndex].text : 'NomDuServeur';
        
        // 1. Text message templates replacement simulation
        let renderedMsg = '';
        if (aiEnabled.checked) {
            const promptVal = aiPrompt.value.trim() || 'Accueille de façon chaleureuse et créative.';
            renderedMsg = `
                <div style="font-family: var(--font-inter); font-size: 13px; border-left: 3px solid var(--accent-neon); background: rgba(155, 93, 229, 0.05); padding: 10px 14px; border-radius: 4px; margin-bottom: 12px; color: #e3e5e8; border: 1px solid rgba(155, 93, 229, 0.15);">
                    <div style="color: var(--accent-neon); font-family: var(--font-outfit); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                        <span style="font-size: 14px;">🧠</span>
                        Message d'accueil dynamique par IA (Mistral)
                    </div>
                    <div style="font-style: italic; color: #b5bac1; font-size: 13px; line-height: 1.4;">
                        "Bienvenue <span style="color: #5865f2; font-weight: 500;">@NouveauMembre</span> sur notre serveur ! [Un message d'accueil unique sera généré à chaque arrivée de membre en suivant votre consigne : '${promptVal}']"
                    </div>
                </div>
            `;
        } else {
            let template = messageTemplate.value || 'مرحباً بك {user} في السيرفر! يرجى الانتظار حتى يتم التحقق من حسابك. 🛡️';
            renderedMsg = template
                .replace(/{user}/g, '<span style="color: #5865f2; font-weight: 500; cursor: pointer;">@NouveauMembre</span>')
                .replace(/{tag}/g, 'NouveauMembre')
                .replace(/{guild}/g, `<strong>${guildName}</strong>`)
                .replace(/{count}/g, '<strong>42</strong>');
        }
            
        previewTextMsg.innerHTML = renderedMsg;
        
        // 2. Background card rendering
        const background = bgUrl.value.trim();
        if (background) {
            previewCardBg.style.backgroundImage = `url('${background}')`;
        } else {
            previewCardBg.style.backgroundImage = 'linear-gradient(135deg, #1e1f22 0%, #2b2d31 100%)';
        }
        
        // 3. Check if we are using the special welcome-bg.png image for layout offsets
        const isSpecialBg = background.includes('welcome-bg.png');
        const canvasContent = document.querySelector('.card-canvas-content');
        const avatarElement = document.querySelector('.member-avatar');
        
        const color = textColorPicker.value;
        
        if (isSpecialBg) {
            // Apply customized Starry Moon left-side layout
            canvasContent.style.alignItems = 'flex-start';
            canvasContent.style.textAlign = 'left';
            canvasContent.style.paddingLeft = '60px';
            
            avatarElement.style.marginLeft = '40px';
            avatarElement.style.borderColor = '#9b5de5'; // Matching glowing border
            
            // Format Card Title (Default: {tag} -> NouveauMembre)
            const rawTitle = cardTitle.value || '{tag}';
            const formattedTitle = rawTitle
                .replace(/{user}/g, 'NouveauMembre')
                .replace(/{tag}/g, 'NouveauMembre')
                .replace(/{guild}/g, guildName)
                .replace(/{count}/g, '42');
            
            previewCardTitle.innerText = formattedTitle;
            previewCardTitle.style.fontSize = '22px';
            previewCardTitle.style.marginBottom = '6px';
            previewCardTitle.style.color = color; // Colored username
            
            // Member Name standard field is hidden because username is drawn as title
            previewCardMemberName.style.display = 'none';
            
            // Format Card Subtitle (Default: Membre n°{count})
            const rawSubtitle = cardSubtitle.value || 'Membre n°{count}';
            const formattedSubtitle = rawSubtitle
                .replace(/{user}/g, 'NouveauMembre')
                .replace(/{tag}/g, 'NouveauMembre')
                .replace(/{guild}/g, guildName)
                .replace(/{count}/g, '42');
                
            previewCardSubtitle.innerText = formattedSubtitle;
            previewCardSubtitle.style.fontSize = '15px';
            previewCardSubtitle.style.color = '#b7b9d2';
            previewCardSubtitle.style.display = 'block';
            
        } else {
            // Standard centered layout
            canvasContent.style.alignItems = 'center';
            canvasContent.style.textAlign = 'center';
            canvasContent.style.paddingLeft = '20px';
            
            avatarElement.style.marginLeft = '0';
            avatarElement.style.borderColor = 'var(--accent-purple)';
            
            previewCardMemberName.style.display = 'block';
            previewCardMemberName.style.color = color; // User color on standard layout
            
            // Format Card Title (Default: BIENVENUE)
            const rawTitle = cardTitle.value || 'BIENVENUE';
            const formattedTitle = rawTitle
                .replace(/{user}/g, 'NouveauMembre')
                .replace(/{tag}/g, 'NouveauMembre')
                .replace(/{guild}/g, guildName)
                .replace(/{count}/g, '42');
            
            previewCardTitle.innerText = formattedTitle;
            previewCardTitle.style.fontSize = '26px';
            previewCardTitle.style.marginBottom = '4px';
            previewCardTitle.style.color = '#ffffff';
            
            // Format Card Subtitle (Default: Membre n°{count})
            const rawSubtitle = cardSubtitle.value || 'Membre n°{count}';
            const formattedSubtitle = rawSubtitle
                .replace(/{user}/g, 'NouveauMembre')
                .replace(/{tag}/g, 'NouveauMembre')
                .replace(/{guild}/g, guildName)
                .replace(/{count}/g, '42');
                
            previewCardSubtitle.innerText = formattedSubtitle;
            previewCardSubtitle.style.fontSize = '13px';
            previewCardSubtitle.style.color = '#a3a6b5';
            previewCardSubtitle.style.display = 'block';
        }
        
        // 4. Dim down preview if the welcome system is disabled
        const isEnabled = welcomeEnabled.checked;
        const previewContainer = document.querySelector('.discord-preview-container');
        if (isEnabled) {
            previewContainer.style.opacity = '1';
            previewContainer.style.filter = 'none';
        } else {
            previewContainer.style.opacity = '0.6';
            previewContainer.style.filter = 'grayscale(20%)';
        }
    }

    // Color pickers synchronisation
    textColorPicker.addEventListener('input', (e) => {
        textColorHex.value = e.target.value.toUpperCase();
        updateLivePreview();
    });
    
    textColorHex.addEventListener('input', (e) => {
        let val = e.target.value;
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            textColorPicker.value = val;
            updateLivePreview();
        }
    });

    // Auto preview update on keystroke
    messageTemplate.addEventListener('input', updateLivePreview);
    bgUrl.addEventListener('input', updateLivePreview);
    cardTitle.addEventListener('input', updateLivePreview);
    cardSubtitle.addEventListener('input', updateLivePreview);
    welcomeEnabled.addEventListener('change', updateLivePreview);

    // Mistral AI Interaction Listeners
    aiEnabled.addEventListener('change', (e) => {
        if (e.target.checked) {
            aiConfigFields.style.display = 'block';
        } else {
            aiConfigFields.style.display = 'none';
        }
        updateLivePreview();
    });
    
    aiPrompt.addEventListener('input', updateLivePreview);
    aiModel.addEventListener('change', updateLivePreview);
    
    aiAssistBtn.addEventListener('click', async () => {
        const guildId = guildSelect.value;
        if (!guildId) return;
        
        const promptText = aiPrompt.value.trim() || "Tu es un hôte chaleureux. Accueille le membre {user} sur le serveur {guild} en français de façon amicale et créative.";
        const modelVal = aiModel.value || 'open-mistral-7b';
        
        aiAssistBtn.disabled = true;
        const originalText = aiAssistBtn.innerHTML;
        aiAssistBtn.innerHTML = `
            <svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 5px; animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
            Génération...
        `;
        
        try {
            const response = await fetch('/api/ai/generate-template', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: `Rédige un template de message de bienvenue Discord unique et original en te basant sur cette consigne de style : "${promptText}". Tu dois obligatoirement utiliser les balises magiques suivantes pour personnaliser le message: {user} (pour mentionner le membre), {tag} (le nom d'utilisateur), {guild} (le nom du serveur), {count} (le nombre total de membres). Reste court (maximum 1-2 phrases) et ajoute des émojis. Réponds uniquement avec le template textuel de message brut, sans mise en forme markdown de type bloc de code, sans guillemets de début/fin, et sans blabla d'introduction ou de conclusion.`,
                    model: modelVal
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.template) {
                messageTemplate.value = data.template;
                updateLivePreview();
                showToast('Nouveau template généré par Mistral AI avec succès ! ✨', 'success');
            } else {
                throw new Error(data.error || 'Failed to generate template');
            }
        } catch (err) {
            console.error('Error generating template:', err);
            showToast(`Erreur IA : ${err.message}`, 'error');
        } finally {
            aiAssistBtn.disabled = false;
            aiAssistBtn.innerHTML = originalText;
        }
    });



    // 5. DRAG & DROP FILE UPLOADER
    dropZone.addEventListener('click', () => {
        if (!guildSelect.value) {
            showToast('Veuillez sélectionner un serveur Discord d\'abord !', 'error');
            return;
        }
        fileInput.click();
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (guildSelect.value) dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        if (!guildSelect.value) {
            showToast('Veuillez sélectionner un serveur Discord d\'abord !', 'error');
            return;
        }
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    async function handleFileUpload(file) {
        if (!file.type.match('image.*')) {
            showToast('Veuillez envoyer uniquement des fichiers images !', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('background', file);
        
        // Show status
        const textEl = dropZone.querySelector('.upload-text');
        const originalText = textEl.innerHTML;
        textEl.innerHTML = '<span style="color: var(--accent-purple);">Téléchargement en cours...</span>';
        
        try {
            const response = await fetch('/api/config/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                bgUrl.value = data.url;
                updateLivePreview();
                showToast('Image importée avec succès !', 'success');
            } else {
                throw new Error(data.error || 'Upload error');
            }
        } catch (err) {
            console.error('Upload failed:', err);
            showToast(`Échec du téléchargement : ${err.message}`, 'error');
        } finally {
            textEl.innerHTML = originalText;
        }
    }

    // 6. SAVE CONFIGURATION TO SUPABASE
    saveConfigBtn.addEventListener('click', async () => {
        const guildId = guildSelect.value;
        if (!guildId) return;
        
        saveConfigBtn.disabled = true;
        saveConfigBtn.innerHTML = '<svg class="animate-spin" style="margin-right: 8px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg> Enregistrement...';

        const payload = {
            guild_id: guildId,
            channel_id: channelSelect.value,
            message_template: messageTemplate.value,
            background_url: bgUrl.value.trim(),
            text_color: textColorPicker.value,
            card_title: cardTitle.value.trim(),
            card_subtitle: cardSubtitle.value.trim(),
            is_enabled: welcomeEnabled.checked,
            is_ai_enabled: aiEnabled.checked,
            ai_prompt: aiPrompt.value.trim(),
            ai_model: aiModel.value
        };

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                showToast('Configuration enregistrée dans Supabase avec succès !', 'success');
            } else {
                throw new Error(data.error || 'Save error');
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            showToast(`Échec de la sauvegarde : ${err.message}`, 'error');
        } finally {
            saveConfigBtn.disabled = false;
            saveConfigBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Sauvegarder';
        }
    });

    // 7. TEST GREETING IN REAL TIME ON DISCORD SERVER
    testCardBtn.addEventListener('click', async () => {
        const guildId = guildSelect.value;
        const channelId = channelSelect.value;
        
        if (!guildId || !channelId) {
            showToast('Sélectionnez un serveur et un salon de réception avant de tester !', 'error');
            return;
        }
        
        testCardBtn.disabled = true;
        testCardBtn.innerHTML = 'Envoi...';

        try {
            // First save settings to ensure latest properties are tested
            const saveResponse = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    guild_id: guildId,
                    channel_id: channelId,
                    message_template: messageTemplate.value,
                    background_url: bgUrl.value.trim(),
                    text_color: textColorPicker.value,
                    card_title: cardTitle.value.trim(),
                    card_subtitle: cardSubtitle.value.trim(),
                    is_enabled: welcomeEnabled.checked,
                    is_ai_enabled: aiEnabled.checked,
                    ai_prompt: aiPrompt.value.trim(),
                    ai_model: aiModel.value
                })
            });

            if (!saveResponse.ok) throw new Error('Failed to save settings prior to testing.');

            const testResponse = await fetch('/api/bot/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    guild_id: guildId,
                    channel_id: channelId
                })
            });

            const data = await testResponse.json();

            if (testResponse.ok) {
                showToast('Message de test envoyé sur Discord ! 🎉', 'success');
            } else {
                throw new Error(data.error || 'Test error');
            }
        } catch (err) {
            console.error('Error sending test welcome:', err);
            showToast(`Échec du test : ${err.message}`, 'error');
        } finally {
            testCardBtn.disabled = false;
            testCardBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Tester en direct';
        }
    });

    // 8. LOGOUT
    logoutBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            if (response.ok) {
                showToast('Déconnexion réussie.', 'success');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 800);
            }
        } catch (err) {
            console.error('Logout error:', err);
        }
    });

    // Launch auth check
    checkAuth();
});
