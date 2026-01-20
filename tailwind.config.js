/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#11998E', // Teal from screenshot
                secondary: '#2B3674',
                success: '#05CD99',
                danger: '#EE5D50',
                warning: '#FFCE20',
                info: '#11CDEF',
                background: '#F4F7FE',
                navy: '#2B3674',
            },
            fontFamily: {
                sans: ['DM Sans', 'sans-serif'],
            },
            boxShadow: {
                'card': '0px 3px 20px rgba(112, 144, 176, 0.08)',
                'purple': '0px 10px 20px rgba(67, 24, 255, 0.18)',
            },
            borderRadius: {
                'xl': '20px',
            }
        },
    },
    plugins: [],
}
