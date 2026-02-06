function locationURL() {
    location.href = "/main/portfolio/html/page2.html";
}   
function locationURL() {
    location.href = "/main/portfolio/html/calc.html";
}  
function showAlert() {
    alert("This is a simple calculator!");
let num1 = alert.prompt("Enter the first number:");
let num2 = alert.prompt("Enter the second number:");

num1 = parseFloat(num1);
num2 = parseFloat(num2);

alert("The sum of " + num1 + " and " + num2 + " is: " + (num1 + num2));
if (isNaN(num1) || isNaN(num2)) {
    console.log("Invalid input. Please enter numeric values.");
} else {
    const sum = num1 + num2;
    console.log("The sum of " + num1 + " and " + num2 + " is: " + sum);
    }

}
