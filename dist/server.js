const { faker } = require('@faker-js/faker');
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

    const browser = await chromium.launch({ headless: false });
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
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    try {

        const locationTitle = `//span[contains(text(),'${companyName}')]`;
        const typeReport = `//span[contains(text(),'${dictReport.report[reportType]}')]`;
        const optionCurrentReport = "//label[text()='Current Report']";
        const buttonContinue = '.basketPay-buttonPad-item2-completeTransactionButton'
        const submitButton = '.brRequestExtract-buttonPad-applyButton'
        const checkAllDocuments = '//label[contains(@for,"SelectAllFiling")]'
        const buttonRequestDocuments = '.listAndRequestDocumentCopies-buttonPad-apply'

        await page.goto(urlState);
        await page.locator(locationTitle).click();
        await page.locator(".appSubMenuName").click();
        const visible = await page.locator(typeReport).isVisible();
        if(visible){
            await page.locator(typeReport).click()
        }else{
            res.status(404).json({message: `The document type "${dictReport.report[reportType]}" doesn't exist for "${companyName}" business registry`});
            await page.close();
        }
        await page.waitForTimeout(2000);
        await page.getByRole('textbox', {name:"Requestor’s Email Address * Requestor’s Email Address Opens a help popup."}).fill("sebastian.duque@infotrackcanada.com")
        await page.getByRole('textbox', {name:"Confirm Requestor's Email Address *"}).fill("sebastian.duque@infotrackcanada.com")
        switch(reportType){
            case 0:
                await page.locator(optionCurrentReport).click()
                await page.locator(submitButton).click();
                break;
            case 1:
                await page.locator(checkAllDocuments).click();
                await page.locator(buttonRequestDocuments).click();
                break;
            case 2:
                console.log(typeReport)
                await page.locator('.requestCertificateOfStatus-buttonPad-apply').click();
                break;
        }
        

        const dropdown = page.locator('//select[contains(@name,"Method")]');
        dropdown.selectOption("creditCardPayment");
        const urlPaymentProccess = page.url();
        await page.locator(buttonContinue).click();
        
        await page.getByAltText('Make Payment').click();
        await page.getByPlaceholder('Name on card').fill(faker.finance.accountName())
        await page.getByPlaceholder('Card number').fill(faker.finance.creditCardNumber())
        await page.locator('select[name="trnExpMonth"]').selectOption("11")
        await page.locator('select[name="trnExpYear"]').selectOption("30")
        await page.locator('input[name="trnCardCvd"]').fill(faker.finance.creditCardCVV())
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
