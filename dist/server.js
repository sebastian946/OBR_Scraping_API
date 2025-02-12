const { faker } = require('@faker-js/faker');
const express = require('express');
const { chromium } = require('playwright');
const { expect } = require('playwright/test');
require("dotenv").config();

const app = express();
const PORT = 8080;

app.use(express.json());

const dictReport = {
    document: ["Request Profile Report", "List and Request Document Copies", "Request Certificate of Status"],
    report:['Current Report', 'Previous Date']

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
            let i=1;
            const nodes = Array.from(document.querySelectorAll('.appRepeaterRowContent'));
            return nodes.map(node => ({
                id: i++,
                type: node.querySelector('.appRecordChildren .appRawText')?.textContent?.trim() || 'Without title',
                value: node.querySelector('.appRecordChildren .appMinimalMenu a span:nth-child(2)')?.textContent?.trim() || 'Without title',
                address: node.querySelector('.appRecordChildren .appAttrValue')?.textContent?.trim() || 'Without location',
                status: node.querySelector('.appRecordChildren .Status .appMinimalValue')?.textContent?.trim() || 'Without status',
                previousNames: Array.from(node.querySelectorAll('.appMinimalBox .appMinimalRep .appMinimalValue'))
                .map(el => el.textContent.trim()) || ['Without known as']
            }));
        });
        const urlStatus = page.url();
        res.json({ urlStatus, companies });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'The process failed' });
    } finally {
        await browser.close();
    }
});

app.use('/selectCompany', async (req, res) => {
    const { userEmail,urlState, companyName, documentType, reportType, previousDate } = req.body;
    if (!companyName) {
        return res.status(500).json({ message: "Required the name company" });
    }
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    try {

        const locationTitle = `//span[contains(text(),'${companyName}')]`;
        const typeReport = `//span[contains(text(),'${dictReport.document[documentType]}')]`;
        const optionCurrentReport = `//label[text()='${dictReport.report[reportType]}']`;
        const buttonContinue = '.basketPay-buttonPad-item2-completeTransactionButton'
        const submitButton = '.brRequestExtract-buttonPad-applyButton'
        const checkAllDocuments = '//label[contains(@for,"SelectAllFiling")]'
        const buttonRequestDocuments = '.listAndRequestDocumentCopies-buttonPad-apply'
        const inputPreviousDate = '.webuiValidateDate';
        const buttonOk = 'a[id="flashOkButton"]';
        const messagePay = '.flashmsgs';
        const inputClientReference = '//input[contains(@name,"ClientReference")]'

        await page.goto(urlState);
        await page.locator(locationTitle).click();
        await page.locator(".appSubMenuName").click();
        const visible = await page.locator(typeReport).isVisible();
        if(visible){
            await page.locator(typeReport).click()
        }else{
            res.status(404).json({ message: `The document type "${dictReport.document[documentType]}" doesn't exist for "${companyName}" business registry` });
            await page.close();
            return;
        }
        await page.waitForTimeout(2000);
        const email = "sebastian.duque@infotrackcanada.com"
        await page.getByRole('textbox', {name:"Requestor’s Email Address * Requestor’s Email Address Opens a help popup."}).fill(email)
        await page.getByRole('textbox', {name:"Confirm Requestor's Email Address *"}).fill(email)
        switch(documentType){
            case 0:
                await page.locator(optionCurrentReport).click()
                if(reportType == 1){
                    const date = new Date(previousDate);
                    const dateFormat = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
                    await page.locator(inputPreviousDate).fill(dateFormat)
                }
                await page.locator(submitButton).click();
                break;
            case 1:
                await page.locator(checkAllDocuments).click();
                await page.locator(buttonRequestDocuments).click();
                break;
            case 2:
                await page.locator('.requestCertificateOfStatus-buttonPad-apply').click();
                break;
        }
        
        await page.locator(inputClientReference).fill(userEmail)
        const dropdown = page.locator('//select[contains(@name,"Method")]');
        dropdown.selectOption("creditCardPayment");
        const urlPaymentProccess = page.url();
        await page.locator(buttonContinue).click();
        
        await page.getByAltText('Make Payment').click();
        await page.getByPlaceholder('Name on card').fill(process.env.CREDIT_NAME || faker.person.fullName())
        await page.getByPlaceholder('Card number').fill(process.env.CREDIT_NUMBER || faker.finance.creditCardNumber())
        await page.locator('select[name="trnExpMonth"]').selectOption(process.env.CREDIT_EXPIRATION_MONTH || "11")
        await page.locator('select[name="trnExpYear"]').selectOption(process.env.CREDIT_EXPIRATION_YEAR || "30")
        await page.locator('input[name="trnCardCvd"]').fill(process.env.CREDIT_CVD || faker.finance.creditCardCVV())
        await page.locator('input[id="submitButton"]').click()

        await page.locator(messagePay).waitFor({ timeout: 10_000 });
        const message = await page.locator(messagePay).textContent();
        await page.locator(buttonOk).click()
        const urlPayment = page.url();

        res.status(200).json({ urlPaymentProccess, urlPayment, message });
    } catch (errorMessage) {
        res.status(500).json({ message: `Something gone wrong ${errorMessage}` });
    } finally {
        await page.close();
    }
})

app.listen(PORT, () => {
    console.log(`Server listening on port: ${PORT}`);
});
