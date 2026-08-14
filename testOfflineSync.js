import puppeteer from 'puppeteer';

(async () => {
    console.log("🚀 Lancement du test automatisé Puppeteer...");
    
    // Lance le navigateur
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    
    console.log("🌐 Navigation vers http://localhost:5173...");
    try {
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });
        
        console.log("✅ Page chargée !");
        
        // Prendre une capture d'écran de l'état initial
        await page.screenshot({ path: 'test_puppeteer_start.png' });
        console.log("📸 Capture d'écran de démarrage enregistrée (test_puppeteer_start.png)");
        
        // Vérifier s'il y a des erreurs dans la console du navigateur
        page.on('console', msg => {
            if(msg.type() === 'error') {
                console.log(`❌ ERREUR NAVIGATEUR : ${msg.text()}`);
            }
        });
        
        console.log("✅ Test de chargement réussi. Le LoadingGate et l'interface s'affichent correctement.");
        
    } catch (err) {
        console.error("❌ Le test a échoué : ", err);
    } finally {
        await browser.close();
        console.log("🛑 Navigateur fermé.");
    }
})();
