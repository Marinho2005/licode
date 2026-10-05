#include <iostream>
#include <stdexcept>

int main() {
  try {
    throw std::runtime_error("boom");
  } catch (const std::exception& e) {
    std::cout << "caught: " << e.what() << '\n';
  }
  return 0;
}
