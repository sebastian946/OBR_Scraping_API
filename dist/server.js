const express = require('express');
const { chromium } = require('playwright');
const { expect } = require('playwright/test');

const app = express();
const PORT = 8080;

app.use(express.json());

const dictReport = {
    report: ["Request Profile Report", "List and Request Document Copies", "Request Certificate of Status"]
}
app.post('/search', async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'Please send a value' });
    }

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        const inputName = 'input[id="QueryString"]';
        const buttonSearch = '.appSearchButton';

        const searchUrl = 'https://www.appmybizaccount.gov.on.ca/onbis/master/entry.pub?applicationCode=onbis-master&businessService=registerItemSearch';
        await page.goto(searchUrl);

        await page.locator(inputName).fill(query);
        await page.locator(buttonSearch).click();

        await page.waitForSelector('.appRepeaterRowContent', { state: 'visible', timeout: 5000 });

        const companies = await page.evaluate(() => {
            const nodes = Array.from(document.querySelectorAll('.appRepeaterRowContent'));
            return nodes.map(node => ({
                type: node.querySelector('.appRecordChildren .appRawText')?.textContent?.trim() || 'Without title',
                titleCompanyName: node.querySelector('.appRecordChildren .appMinimalMenu a span:nth-child(2)')?.textContent?.trim() || 'Without title',
                location: node.querySelector('.appRecordChildren .appAttrValue')?.textContent?.trim() || 'Without location',
                companyStatus: node.querySelector('.appRecordChildren .Status .appMinimalValue')?.textContent?.trim() || 'Without status'
            }));
        });
        const urlStatus = page.url();
        res.json({ query, urlStatus, companies });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'The process failed' });
    } finally {
        await browser.close();
    }
});

app.use('/selectCompany', async (req, res) => {
    const { urlState, companyName, reportType } = req.body;
    if (!companyName) {
        return res.status(500).json({ message: "Required the name company" });
    }
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {

        const locationTitle = `//span[contains(text(),'${companyName}')]`;
        const typeReport = `//span[contains(text(),'${dictReport.report[reportType]}')]`;
        const optionCurrentReport = "//label[text()='Current Report']";
        const buttonContinue = '.basketPay-buttonPad-item2-completeTransactionButton'
        const submitButton = '.brRequestExtract-buttonPad-applyButton'

        await page.goto(urlState);
        await page.locator(locationTitle).click();
        await page.locator(".appSubMenuName").click();
        await page.locator(typeReport).click()
        await page.locator(optionCurrentReport).click()
        await page.waitForTimeout(2000);
        await page.getByRole('textbox', {name:"Requestor’s Email Address * Requestor’s Email Address Opens a help popup."}).fill("sebastian.duque@infotrackcanada.com")
        await page.getByRole('textbox', {name:"Confirm Requestor's Email Address *"}).fill("sebastian.duque@infotrackcanada.com")
        await page.locator(submitButton).click();

        const dropdown = page.locator('//select[contains(@name,"Method")]');
        dropdown.selectOption("debitCardPayment");
        const urlPaymentProccess = page.url();
        await page.locator(buttonContinue).click();
        
        await page.getByAltText('Make Payment').click();
        await page.getByPlaceholder('Name on card').fill('Test Name')
        await page.getByPlaceholder('Card number').fill('1234567890')
        await page.locator('select[name="trnExpMonth"]').selectOption("01")
        await page.locator('select[name="trnExpYear"]').selectOption("28")
        await page.locator('input[name="trnCardCvd"]').fill("230")
        await page.locator('input[id="submitButton"]').click()
        
        const urlPayment = page.url();

        res.status(200).json({ urlPaymentProccess, urlPayment });
    } catch (errorMessage) {
        res.status(500).json({ message: `Something gone wrong ${errorMessage}` });
    } finally {
        await page.close();
    }
})

app.listen(PORT, () => {
    console.log(`Server listening on port: ${PORT}`);
});
